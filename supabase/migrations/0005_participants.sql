-- 약속 참여. 상태 변경은 set_participation RPC로만 한다.
create table public.event_participants (
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null check (status in ('going', 'maybe', 'not_going', 'waitlisted')),
  -- 대기 순서는 waitlisted가 된 시각 순이다.
  updated_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create index event_participants_event_status_idx
  on public.event_participants (event_id, status, updated_at);
create index event_participants_user_id_idx on public.event_participants (user_id);

create function public.can_view_event(eid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.events e
    join public.group_members m on m.group_id = e.group_id
    where e.id = eid and m.user_id = (select auth.uid())
  );
$$;

alter table public.event_participants enable row level security;

create policy "멤버만 참여 현황 조회"
  on public.event_participants for select
  to authenticated
  using (public.can_view_event(event_id));

-- 자리가 나는 만큼 먼저 대기한 사람부터 참여로 올린다.
-- 호출하는 쪽에서 events 행을 잠근 상태여야 한다.
create function public.promote_waitlist(eid uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  cap int;
  going int;
  next_user uuid;
begin
  select max_people into cap from public.events where id = eid;

  loop
    select count(*) into going
    from public.event_participants
    where event_id = eid and status = 'going';

    exit when cap is not null and going >= cap;

    select user_id into next_user
    from public.event_participants
    where event_id = eid and status = 'waitlisted'
    order by updated_at
    limit 1;

    exit when next_user is null;

    update public.event_participants
    set status = 'going', updated_at = now()
    where event_id = eid and user_id = next_user;
  end loop;
end;
$$;

-- 내 참여 상태를 바꾸고 최종 상태를 돌려준다. 정원이 찼으면 going 대신 waitlisted가 된다.
create function public.set_participation(eid uuid, new_status text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  ev record;
  prev text;
  going int;
  result text := new_status;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  if new_status not in ('going', 'maybe', 'not_going') then
    raise exception 'invalid status';
  end if;

  -- 같은 약속에 동시에 신청해도 정원을 넘지 않도록 약속 행을 잠근다.
  select id, group_id, starts_at, max_people into ev
  from public.events where id = eid
  for update;

  if ev.id is null or not exists (
    select 1 from public.group_members where group_id = ev.group_id and user_id = uid
  ) then
    raise exception 'event not found';
  end if;
  if ev.starts_at < now() then
    raise exception 'event already started';
  end if;

  select status into prev
  from public.event_participants
  where event_id = eid and user_id = uid;

  if new_status = 'going' then
    -- 이미 참여 중이거나 대기 중이면 순서를 유지한다.
    if prev in ('going', 'waitlisted') then
      return prev;
    end if;

    select count(*) into going
    from public.event_participants
    where event_id = eid and status = 'going';

    if ev.max_people is not null and going >= ev.max_people then
      result := 'waitlisted';
    end if;
  end if;

  insert into public.event_participants (event_id, user_id, status, updated_at)
  values (eid, uid, result, now())
  on conflict (event_id, user_id)
  do update set status = excluded.status, updated_at = excluded.updated_at;

  if prev = 'going' and result <> 'going' then
    perform public.promote_waitlist(eid);
  end if;

  return result;
end;
$$;

-- 약속을 만든 사람은 자동으로 참여한다.
create function public.add_creator_as_participant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.event_participants (event_id, user_id, status)
  values (new.id, new.created_by, 'going');
  return new;
end;
$$;

create trigger events_add_creator
  after insert on public.events
  for each row execute function public.add_creator_as_participant();

-- 이 마이그레이션 전에 만든 약속도 만든 사람을 참여자로 넣는다.
insert into public.event_participants (event_id, user_id, status)
select id, created_by, 'going' from public.events
on conflict do nothing;

-- 최대 인원을 늘리거나 없애면 대기자를 올린다. 줄이면 기존 참여자는 그대로 둔다.
create function public.promote_on_capacity_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.max_people is null or new.max_people > coalesce(old.max_people, 0) then
    perform public.promote_waitlist(new.id);
  end if;
  return new;
end;
$$;

create trigger events_promote_on_capacity_change
  after update of max_people on public.events
  for each row execute function public.promote_on_capacity_change();

grant select on public.event_participants to authenticated;

revoke execute on function public.can_view_event(uuid) from public, anon;
revoke execute on function public.promote_waitlist(uuid) from public, anon, authenticated;
revoke execute on function public.set_participation(uuid, text) from public, anon;
revoke execute on function public.add_creator_as_participant() from public, anon, authenticated;
revoke execute on function public.promote_on_capacity_change() from public, anon, authenticated;

grant execute on function public.can_view_event(uuid) to authenticated;
grant execute on function public.set_participation(uuid, text) to authenticated;
