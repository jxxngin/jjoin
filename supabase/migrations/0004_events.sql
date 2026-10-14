-- 약속. 장소 좌표·링크는 카카오맵 검색(6단계)에서 채운다.
create table public.events (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 50),
  starts_at timestamptz not null,
  place_name text check (char_length(place_name) <= 100),
  place_address text,
  place_lat double precision,
  place_lng double precision,
  place_url text,
  min_people int check (min_people >= 1),
  max_people int check (max_people >= 1),
  memo text check (char_length(memo) <= 500),
  created_by uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (min_people is null or max_people is null or min_people <= max_people)
);

create index events_group_id_starts_at_idx on public.events (group_id, starts_at);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger events_set_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();

create function public.is_group_owner(gid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.groups
    where id = gid and owner_id = (select auth.uid())
  );
$$;

alter table public.events enable row level security;

create policy "멤버만 약속 조회"
  on public.events for select
  to authenticated
  using (public.is_group_member(group_id));

create policy "멤버는 약속 생성"
  on public.events for insert
  to authenticated
  with check (
    public.is_group_member(group_id) and created_by = (select auth.uid())
  );

create policy "만든 사람 또는 방장이 약속 수정"
  on public.events for update
  to authenticated
  using (created_by = (select auth.uid()) or public.is_group_owner(group_id))
  with check (public.is_group_member(group_id));

create policy "만든 사람 또는 방장이 약속 삭제"
  on public.events for delete
  to authenticated
  using (created_by = (select auth.uid()) or public.is_group_owner(group_id));

-- 수정은 내용 컬럼만. 그룹·만든 사람은 바꿀 수 없다.
grant select, delete on public.events to authenticated;
grant insert (
  group_id, title, starts_at, place_name, place_address, place_lat, place_lng,
  place_url, min_people, max_people, memo
) on public.events to authenticated;
grant update (
  title, starts_at, place_name, place_address, place_lat, place_lng,
  place_url, min_people, max_people, memo
) on public.events to authenticated;

revoke execute on function public.is_group_owner(uuid) from public, anon;
grant execute on function public.is_group_owner(uuid) to authenticated;
