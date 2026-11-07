-- 날짜 투표에서도 장소 투표를 한다.
-- 장소 후보(place_options)는 약속(event_id) 또는 날짜 투표(poll_id) 중 하나에 붙는다.
-- 날짜 투표를 확정해 약속이 생기면, 아직 확정하지 않은 장소 후보와 표는 그 약속으로 옮겨 가 투표가 이어진다.

alter table public.place_options
  alter column event_id drop not null,
  add column poll_id uuid references public.date_polls (id) on delete cascade,
  add constraint place_options_one_target check (num_nonnulls(event_id, poll_id) = 1),
  add constraint place_options_poll_id_place_url_key unique (poll_id, place_url);

create index place_options_poll_id_idx on public.place_options (poll_id, created_at);

grant insert (poll_id) on public.place_options to authenticated;

-- 그 후보가 붙은 약속이나 투표를 볼 수 있는지 (= 같은 그룹 멤버)
create or replace function public.can_view_place_option(oid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.place_options o
    where o.id = oid
      and (
        (o.event_id is not null and public.can_view_event(o.event_id))
        or (o.poll_id is not null and public.can_view_poll(o.poll_id))
      )
  );
$$;

drop policy "멤버만 장소 후보 조회" on public.place_options;
drop policy "멤버는 본인 이름으로 장소 후보 추가" on public.place_options;
drop policy "올린 사람·약속 관리자가 장소 후보 삭제" on public.place_options;

create policy "멤버만 장소 후보 조회"
  on public.place_options for select to authenticated
  using (
    (event_id is not null and public.can_view_event(event_id))
    or (poll_id is not null and public.can_view_poll(poll_id))
  );

create policy "멤버는 본인 이름으로 장소 후보 추가"
  on public.place_options for insert to authenticated
  with check (
    added_by = (select auth.uid())
    and (
      (event_id is not null and public.can_view_event(event_id))
      or (poll_id is not null and public.can_view_poll(poll_id))
    )
  );

-- 올린 사람이 지우거나, 약속·투표를 관리하는 사람(만든 사람·방장)이 지운다.
create policy "올린 사람·관리자가 장소 후보 삭제"
  on public.place_options for delete to authenticated
  using (
    added_by = (select auth.uid())
    or exists (
      select 1 from public.events e
      where e.id = event_id and (e.created_by = (select auth.uid()) or public.is_group_owner(e.group_id))
    )
    or exists (
      select 1 from public.date_polls p
      where p.id = poll_id and (p.created_by = (select auth.uid()) or public.is_group_owner(p.group_id))
    )
  );

-- 고른 후보를 약속(또는 날짜 투표)의 장소로 확정하고, 같은 곳에 붙은 장소 후보를 모두 정리한다.
-- 약속·투표를 만든 사람이나 방장만 할 수 있다.
create or replace function public.confirm_place_option(p_option_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  opt record;
  target record;
begin
  select * into opt from public.place_options where id = p_option_id;
  if opt.id is null then
    raise exception 'option not found';
  end if;

  if opt.event_id is not null then
    select id, group_id, created_by into target from public.events where id = opt.event_id for update;
  else
    select id, group_id, created_by into target from public.date_polls where id = opt.poll_id for update;
  end if;
  if uid is distinct from target.created_by and not exists (
    select 1 from public.groups where id = target.group_id and owner_id = uid
  ) then
    raise exception 'not allowed';
  end if;

  if opt.event_id is not null then
    update public.events
    set place_name = opt.place_name, place_address = opt.place_address,
        place_lat = opt.place_lat, place_lng = opt.place_lng, place_url = opt.place_url
    where id = opt.event_id;
    delete from public.place_options where event_id = opt.event_id;
  else
    update public.date_polls
    set place_name = opt.place_name, place_address = opt.place_address,
        place_lat = opt.place_lat, place_lng = opt.place_lng, place_url = opt.place_url
    where id = opt.poll_id;
    delete from public.place_options where poll_id = opt.poll_id;
  end if;

  return target.id;
end;
$$;

-- (0017과 같고, 끝에서 아직 확정하지 않은 장소 후보와 표를 새 약속으로 옮긴다)
-- 고른 후보로 약속을 만들고 투표를 닫는다. 기간 후보면 끝나는 시각도 약속에 넣는다.
-- 그 후보에 투표한 사람은 투표한 순서대로 참여(정원이 차면 대기)한다.
create or replace function public.confirm_date_poll(p_poll_id uuid, p_option_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  poll record;
  chosen record;
  new_event uuid;
  voter uuid;
  going int;
begin
  select * into poll from public.date_polls where id = p_poll_id for update;
  if poll.id is null then
    raise exception 'poll not found';
  end if;
  if uid is distinct from poll.created_by and not exists (
    select 1 from public.groups where id = poll.group_id and owner_id = uid
  ) then
    raise exception 'not allowed';
  end if;
  if poll.event_id is not null then
    raise exception 'already confirmed';
  end if;

  select starts_at, ends_at into chosen from public.date_poll_options where id = p_option_id and poll_id = p_poll_id;
  if chosen.starts_at is null then
    raise exception 'option not found';
  end if;

  -- 약속을 만들면 기존 트리거가 만든 사람을 참여시키고 새 약속 알림을 쌓는다.
  insert into public.events (
    group_id, title, starts_at, ends_at, place_name, place_address, place_lat, place_lng, place_url, max_people, memo, created_by
  )
  values (
    poll.group_id, poll.title, chosen.starts_at, chosen.ends_at, poll.place_name, poll.place_address, poll.place_lat,
    poll.place_lng, poll.place_url, poll.max_people, poll.memo, poll.created_by
  )
  returning id into new_event;

  for voter in
    select v.user_id
    from public.date_poll_votes v
    join public.group_members m on m.group_id = poll.group_id and m.user_id = v.user_id
    where v.option_id = p_option_id and v.user_id <> poll.created_by
    order by v.created_at
  loop
    select count(*) into going from public.event_participants where event_id = new_event and status = 'going';
    insert into public.event_participants (event_id, user_id, status)
    values (
      new_event,
      voter,
      case when poll.max_people is null or going < poll.max_people then 'going' else 'waitlisted' end
    )
    on conflict do nothing;
  end loop;

  update public.date_polls
  set closed_at = coalesce(closed_at, now()), event_id = new_event
  where id = p_poll_id;

  -- 장소 투표가 진행 중이었으면 후보와 표를 새 약속으로 넘겨 이어서 투표한다.
  update public.place_options set event_id = new_event, poll_id = null where poll_id = p_poll_id;

  return new_event;
end;
$$;
