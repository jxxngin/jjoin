-- 약속 장소 투표.
------------------------------------------------------------
-- 장소 투표: 약속마다 멤버 누구나 카카오맵 장소를 후보로 올리고 투표한다.
--    만든 사람이나 방장이 하나를 확정하면 약속 장소가 되고 후보는 정리된다.
------------------------------------------------------------
create table public.place_options (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  place_name text not null check (char_length(place_name) between 1 and 100),
  place_address text check (char_length(place_address) <= 200),
  place_lat double precision not null check (place_lat between -90 and 90),
  place_lng double precision not null check (place_lng between -180 and 180),
  place_url text not null check (place_url ~ '^https://place\.map\.kakao\.com/\d+$'),
  added_by uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (event_id, place_url)
);

create index place_options_event_id_idx on public.place_options (event_id, created_at);

-- id를 따로 둔다. (option_id, user_id)를 기본 키로 하면 PostgREST가 후보↔프로필 연결 표로 보고
-- place_options의 profiles(...) 조회가 "관계가 둘"이라며 실패한다. (0018 comment_likes와 같은 이유)
create table public.place_votes (
  id uuid primary key default gen_random_uuid(),
  option_id uuid not null references public.place_options (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (option_id, user_id)
);

-- 그 후보의 약속을 볼 수 있는지 (= 같은 그룹 멤버)
create function public.can_view_place_option(oid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.place_options o where o.id = oid and public.can_view_event(o.event_id)
  );
$$;

revoke execute on function public.can_view_place_option(uuid) from public, anon;
grant execute on function public.can_view_place_option(uuid) to authenticated;

alter table public.place_options enable row level security;
alter table public.place_votes enable row level security;

create policy "멤버만 장소 후보 조회"
  on public.place_options for select to authenticated
  using (public.can_view_event(event_id));

create policy "멤버는 본인 이름으로 장소 후보 추가"
  on public.place_options for insert to authenticated
  with check (public.can_view_event(event_id) and added_by = (select auth.uid()));

-- 올린 사람이 지우거나, 약속을 고칠 수 있는 사람(만든 사람·방장)이 지운다.
create policy "올린 사람·약속 관리자가 장소 후보 삭제"
  on public.place_options for delete to authenticated
  using (
    added_by = (select auth.uid())
    or exists (
      select 1 from public.events e
      where e.id = event_id and (e.created_by = (select auth.uid()) or public.is_group_owner(e.group_id))
    )
  );

create policy "멤버만 장소 표 조회"
  on public.place_votes for select to authenticated
  using (public.can_view_place_option(option_id));

create policy "멤버는 본인 장소 표 넣기"
  on public.place_votes for insert to authenticated
  with check (user_id = (select auth.uid()) and public.can_view_place_option(option_id));

create policy "본인 장소 표만 빼기"
  on public.place_votes for delete to authenticated
  using (user_id = (select auth.uid()));

grant select, delete on public.place_options, public.place_votes to authenticated;
grant insert (event_id, place_name, place_address, place_lat, place_lng, place_url) on public.place_options to authenticated;
grant insert (option_id) on public.place_votes to authenticated;

-- 고른 후보를 약속 장소로 확정하고, 그 약속의 장소 후보(와 표)를 모두 정리한다.
-- 약속을 만든 사람이나 방장만 할 수 있다.
create function public.confirm_place_option(p_option_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  opt record;
  ev record;
begin
  select * into opt from public.place_options where id = p_option_id;
  if opt.id is null then
    raise exception 'option not found';
  end if;

  select * into ev from public.events where id = opt.event_id for update;
  if uid is distinct from ev.created_by and not exists (
    select 1 from public.groups where id = ev.group_id and owner_id = uid
  ) then
    raise exception 'not allowed';
  end if;

  update public.events
  set place_name = opt.place_name,
      place_address = opt.place_address,
      place_lat = opt.place_lat,
      place_lng = opt.place_lng,
      place_url = opt.place_url
  where id = ev.id;

  delete from public.place_options where event_id = ev.id;

  return ev.id;
end;
$$;

revoke execute on function public.confirm_place_option(uuid) from public, anon;
grant execute on function public.confirm_place_option(uuid) to authenticated;
