-- DB·RLS 코드 리뷰 반영 (#14, 검토용 PR #19). 그룹을 나가거나 내보내진 뒤에도 권한·알림이 남던 곳과 동시성 문제를 고친다.
--
-- 1. [P1] 투표·장소 확정: 만든 사람이라도 지금 그 그룹 멤버가 아니면 거절한다.
--    (나가거나 내보내지면 group_members 행만 지워지고 created_by는 남아서, 알고 있는 id로 직접 부를 수 있었다)
-- 2. [P1] 하루 전·1시간 전 알림: 참여 기록이 남아 있어도 지금 멤버인 사람에게만 쌓는다.
--    멤버가 나가면 그 그룹의 약속·투표에 대해 아직 보내지 않은 알림을 지운다.
-- 3. [P2] 방장 넘기기: 그룹 행을 먼저 잠그고 확인해서, 동시에 두 사람에게 넘겨도 방장이 둘이 되지 않게 한다.
-- 4. [P2] 탈퇴 준비: 방장을 넘길 때 내 역할도 member로 내리고, 대기자 승격은 약속 행을 잠근 뒤에 한다.

------------------------------------------------------------
-- 1. 투표·장소 확정 (0021의 본문 + 멤버 확인)
------------------------------------------------------------
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
  -- 만든 사람이어도 그룹을 나갔거나 내보내졌으면 확정할 수 없다.
  if not exists (select 1 from public.group_members where group_id = poll.group_id and user_id = uid) then
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
  -- 만든 사람이어도 그룹을 나갔거나 내보내졌으면 확정할 수 없다.
  if not exists (select 1 from public.group_members where group_id = target.group_id and user_id = uid) then
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

------------------------------------------------------------
-- 2. 예약 알림은 지금 멤버에게만, 나간 멤버의 보내기 전 알림은 지운다
------------------------------------------------------------
create or replace function public.queue_day_before_notifications()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  tomorrow date := (now() at time zone 'Asia/Seoul')::date + 1;
  queued int;
begin
  with targets as (
    update public.events e
    set day_before_sent_at = now()
    where (e.starts_at at time zone 'Asia/Seoul')::date = tomorrow
      and e.ended_at is null
      and e.day_before_sent_at is null
    returning e.id, e.group_id
  )
  insert into public.notification_outbox (user_id, event_id, kind)
  select p.user_id, t.id, 'day_before'
  from targets t
  join public.event_participants p on p.event_id = t.id and p.status = 'going'
  join public.group_members m on m.group_id = t.group_id and m.user_id = p.user_id;

  get diagnostics queued = row_count;
  return queued;
end;
$$;

create or replace function public.queue_hour_before_notifications()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  queued int;
begin
  with targets as (
    update public.events e
    set hour_before_sent_at = now()
    where e.starts_at > now()
      and e.starts_at <= now() + interval '65 minutes'
      and e.ended_at is null
      and e.hour_before_sent_at is null
    returning e.id, e.group_id
  )
  insert into public.notification_outbox (user_id, event_id, kind)
  select p.user_id, t.id, 'hour_before'
  from targets t
  join public.event_participants p on p.event_id = t.id and p.status = 'going'
  join public.group_members m on m.group_id = t.group_id and m.user_id = p.user_id;

  get diagnostics queued = row_count;
  return queued;
end;
$$;

-- 멤버가 그룹을 나가거나 내보내지면, 그 그룹의 약속·투표에 대해 아직 보내지 않은 알림을 지운다.
-- (보내는 중인 'sending'은 워커가 이미 꺼낸 것이라 그대로 둔다. 알림 기록(종)은 볼 수 없는 화면으로 가므로 남겨도 새지 않는다)
create function public.drop_pending_notifications_of_leaver()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.notification_outbox o
  where o.user_id = old.user_id
    and o.status = 'pending'
    and (
      exists (select 1 from public.events e where e.id = o.event_id and e.group_id = old.group_id)
      or exists (select 1 from public.date_polls d where d.id = o.poll_id and d.group_id = old.group_id)
    );
  return old;
end;
$$;

create trigger group_members_drop_pending_notifications
  after delete on public.group_members
  for each row execute function public.drop_pending_notifications_of_leaver();

revoke execute on function public.drop_pending_notifications_of_leaver() from public, anon, authenticated;

------------------------------------------------------------
-- 3. 방장 넘기기: 그룹 행을 먼저 잠그고 확인 (0014의 본문 + 잠금)
------------------------------------------------------------
create or replace function public.transfer_group_ownership(p_group_id uuid, p_new_owner uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  -- 같은 그룹에 동시에 넘기기가 오면 그룹 행 잠금으로 하나씩 처리한다.
  -- 잠금을 얻은 뒤에 방장인지 다시 보므로, 먼저 끝난 쪽 뒤에 온 요청은 '방장이 아님'으로 거절된다.
  perform 1 from public.groups where id = p_group_id for update;
  if not exists (select 1 from public.groups where id = p_group_id and owner_id = uid) then
    raise exception 'not the owner';
  end if;
  if p_new_owner = uid or not exists (
    select 1 from public.group_members where group_id = p_group_id and user_id = p_new_owner
  ) then
    raise exception 'not a member';
  end if;

  update public.groups set owner_id = p_new_owner where id = p_group_id;
  update public.group_members set role = 'member' where group_id = p_group_id and user_id = uid;
  update public.group_members set role = 'owner' where group_id = p_group_id and user_id = p_new_owner;
end;
$$;

------------------------------------------------------------
-- 4. 탈퇴 준비 (0023의 본문 + 내 역할 내리기 + 약속 행 잠금)
------------------------------------------------------------
create or replace function public.prepare_account_deletion()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  g record;
  heir uuid;
  ev record;
begin
  if uid is null then
    raise exception 'not signed in';
  end if;

  for g in select id from public.groups where owner_id = uid for update loop
    select user_id into heir
    from public.group_members
    where group_id = g.id and user_id <> uid
    order by joined_at
    limit 1;

    if heir is null then
      delete from public.groups where id = g.id;
    else
      update public.groups set owner_id = heir where id = g.id;
      -- 계정 삭제가 뒤따르지 않더라도 방장 권한(카톡 이름 보기 등)이 남지 않게 내 역할도 내린다.
      update public.group_members set role = 'member' where group_id = g.id and user_id = uid;
      update public.group_members set role = 'owner' where group_id = g.id and user_id = heir;
    end if;
  end loop;

  update public.events e
  set created_by = gr.owner_id
  from public.groups gr
  where e.group_id = gr.id and e.created_by = uid;

  update public.date_polls p
  set created_by = gr.owner_id
  from public.groups gr
  where p.group_id = gr.id and p.created_by = uid;

  -- 참여 중인 약속은 set_participation처럼 약속 행을 잠근 뒤 빠지고 대기자를 올린다.
  -- (동시에 여러 사람이 빠져도 같은 대기자를 두 번 올리지 않게)
  for ev in
    select e.id
    from public.events e
    join public.event_participants p on p.event_id = e.id
    where p.user_id = uid and p.status = 'going'
    order by e.id
    for update of e
  loop
    delete from public.event_participants where event_id = ev.id and user_id = uid;
    perform public.promote_waitlist(ev.id);
  end loop;
end;
$$;
