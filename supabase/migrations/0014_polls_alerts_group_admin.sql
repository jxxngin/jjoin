-- 날짜 투표, 1시간 전·댓글 알림, 그룹 관리.

------------------------------------------------------------
-- 1) 날짜 투표
-- 날짜를 못 정한 약속은 투표로 먼저 올린다. 마감하면 표가 많은 날짜 중 하나로 약속을 확정한다.
------------------------------------------------------------
create table public.date_polls (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 50),
  place_name text check (char_length(place_name) <= 100),
  place_address text,
  place_lat double precision,
  place_lng double precision,
  place_url text,
  max_people int check (max_people >= 1),
  memo text check (char_length(memo) <= 500),
  created_by uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  -- 확정해서 만든 약속
  event_id uuid references public.events (id) on delete set null
);

create index date_polls_group_id_idx on public.date_polls (group_id, created_at desc);

create table public.date_poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.date_polls (id) on delete cascade,
  starts_at timestamptz not null,
  unique (poll_id, starts_at)
);

-- 한 사람이 여러 날짜에 투표할 수 있다. (중복 투표)
create table public.date_poll_votes (
  option_id uuid not null references public.date_poll_options (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (option_id, user_id)
);

create function public.can_view_poll(pid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.date_polls p
    join public.group_members m on m.group_id = p.group_id
    where p.id = pid and m.user_id = (select auth.uid())
  );
$$;

-- 그 후보 날짜의 투표가 아직 열려 있고 내가 그룹 멤버인지
create function public.can_vote_option(oid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.date_poll_options o
    join public.date_polls p on p.id = o.poll_id
    join public.group_members m on m.group_id = p.group_id
    where o.id = oid and p.closed_at is null and m.user_id = (select auth.uid())
  );
$$;

alter table public.date_polls enable row level security;
alter table public.date_poll_options enable row level security;
alter table public.date_poll_votes enable row level security;

create policy "멤버만 투표 조회" on public.date_polls for select to authenticated
  using (public.is_group_member(group_id));
create policy "만든 사람·방장이 투표 마감" on public.date_polls for update to authenticated
  using (created_by = (select auth.uid()) or public.is_group_owner(group_id))
  with check (public.is_group_member(group_id));
create policy "만든 사람·방장이 투표 삭제" on public.date_polls for delete to authenticated
  using (created_by = (select auth.uid()) or public.is_group_owner(group_id));

create policy "멤버만 후보 날짜 조회" on public.date_poll_options for select to authenticated
  using (public.can_view_poll(poll_id));

create policy "멤버만 표 조회" on public.date_poll_votes for select to authenticated
  using (exists (select 1 from public.date_poll_options o where o.id = option_id and public.can_view_poll(o.poll_id)));
create policy "열린 투표에 본인 표 넣기" on public.date_poll_votes for insert to authenticated
  with check (user_id = (select auth.uid()) and public.can_vote_option(option_id));
create policy "열린 투표에서 본인 표 빼기" on public.date_poll_votes for delete to authenticated
  using (user_id = (select auth.uid()) and public.can_vote_option(option_id));

grant select, delete on public.date_polls to authenticated;
grant update (closed_at) on public.date_polls to authenticated;
grant select on public.date_poll_options to authenticated;
grant select, delete on public.date_poll_votes to authenticated;
grant insert (option_id) on public.date_poll_votes to authenticated;

-- 투표와 후보 날짜를 한 번에 만든다. 후보는 2~10개.
create function public.create_date_poll(
  p_group_id uuid,
  p_title text,
  p_place_name text,
  p_place_address text,
  p_place_lat double precision,
  p_place_lng double precision,
  p_place_url text,
  p_max_people int,
  p_memo text,
  p_options timestamptz[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  new_id uuid;
begin
  if uid is null or not exists (
    select 1 from public.group_members where group_id = p_group_id and user_id = uid
  ) then
    raise exception 'not a member';
  end if;
  if cardinality(p_options) not between 2 and 10 then
    raise exception 'need 2 to 10 options';
  end if;

  insert into public.date_polls (
    group_id, title, place_name, place_address, place_lat, place_lng, place_url, max_people, memo, created_by
  )
  values (
    p_group_id, trim(p_title), p_place_name, p_place_address, p_place_lat, p_place_lng, p_place_url, p_max_people, p_memo, uid
  )
  returning id into new_id;

  insert into public.date_poll_options (poll_id, starts_at)
  select distinct new_id, option from unnest(p_options) as option;

  return new_id;
end;
$$;

-- 고른 날짜로 약속을 만들고 투표를 닫는다. 그 날짜에 투표한 사람은 투표한 순서대로 참여(정원이 차면 대기)한다.
create function public.confirm_date_poll(p_poll_id uuid, p_option_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  poll record;
  chosen timestamptz;
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

  select starts_at into chosen from public.date_poll_options where id = p_option_id and poll_id = p_poll_id;
  if chosen is null then
    raise exception 'option not found';
  end if;

  -- 약속을 만들면 기존 트리거가 만든 사람을 참여시키고 새 약속 알림을 쌓는다.
  insert into public.events (
    group_id, title, starts_at, place_name, place_address, place_lat, place_lng, place_url, max_people, memo, created_by
  )
  values (
    poll.group_id, poll.title, chosen, poll.place_name, poll.place_address, poll.place_lat, poll.place_lng,
    poll.place_url, poll.max_people, poll.memo, poll.created_by
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

  return new_event;
end;
$$;

revoke execute on function public.can_view_poll(uuid) from public, anon;
revoke execute on function public.can_vote_option(uuid) from public, anon;
revoke execute on function public.create_date_poll(uuid, text, text, text, double precision, double precision, text, int, text, timestamptz[]) from public, anon;
revoke execute on function public.confirm_date_poll(uuid, uuid) from public, anon;
grant execute on function public.can_view_poll(uuid) to authenticated;
grant execute on function public.can_vote_option(uuid) to authenticated;
grant execute on function public.create_date_poll(uuid, text, text, text, double precision, double precision, text, int, text, timestamptz[]) to authenticated;
grant execute on function public.confirm_date_poll(uuid, uuid) to authenticated;

------------------------------------------------------------
-- 2) 알림 종류 추가: 1시간 전(hour_before), 댓글(comment)
------------------------------------------------------------
alter table public.notification_outbox
  drop constraint notification_outbox_kind_check,
  add constraint notification_outbox_kind_check
    check (kind in ('new_event', 'promoted', 'day_before', 'mention', 'hour_before', 'comment'));

alter table public.notifications
  drop constraint notifications_kind_check,
  add constraint notifications_kind_check
    check (kind in ('new_event', 'promoted', 'day_before', 'mention', 'hour_before', 'comment'));

alter table public.profiles
  add column notify_hour_before boolean not null default true,
  add column notify_comment boolean not null default true;
grant update (notify_hour_before, notify_comment) on public.profiles to authenticated;

alter table public.events add column hour_before_sent_at timestamptz;

-- 1시간 안에 시작하는 약속의 참여자에게. 10분마다 불러도 한 번만 쌓인다.
create function public.queue_hour_before_notifications()
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
    returning e.id
  )
  insert into public.notification_outbox (user_id, event_id, kind)
  select p.user_id, t.id, 'hour_before'
  from targets t
  join public.event_participants p on p.event_id = t.id and p.status = 'going';

  get diagnostics queued = row_count;
  return queued;
end;
$$;

revoke execute on function public.queue_hour_before_notifications() from public, anon, authenticated;
grant execute on function public.queue_hour_before_notifications() to service_role;

-- 댓글 알림: 약속 만든 사람과 참여·대기·미정인 사람에게. 쓴 사람과 언급된 사람(언급 알림을 따로 받음)은 뺀다.
create function public.queue_comment_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notification_outbox (user_id, event_id, comment_id, kind)
  select distinct target.user_id, new.event_id, new.id, 'comment'
  from (
    select e.created_by as user_id from public.events e where e.id = new.event_id
    union
    select p.user_id from public.event_participants p
    where p.event_id = new.event_id and p.status in ('going', 'waitlisted', 'maybe')
  ) as target
  where target.user_id <> new.user_id
    and not (target.user_id = any (new.mentions));
  return new;
end;
$$;

create trigger event_comments_queue_comments
  after insert on public.event_comments
  for each row execute function public.queue_comment_notifications();

revoke execute on function public.queue_comment_notifications() from public, anon, authenticated;

------------------------------------------------------------
-- 3) 그룹 관리: 방장 넘기기, 멤버 내보내기, 초대 링크 새로 만들기 (그룹 삭제는 0003의 정책)
------------------------------------------------------------
create policy "방장이 멤버 내보내기"
  on public.group_members for delete
  to authenticated
  using (public.is_group_owner(group_id) and role = 'member');

create function public.transfer_group_ownership(p_group_id uuid, p_new_owner uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
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

-- 예전 초대 링크는 더 이상 쓸 수 없게 된다.
create function public.regenerate_invite_code(p_group_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  code text := substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);
begin
  update public.groups set invite_code = code
  where id = p_group_id and owner_id = auth.uid();
  if not found then
    raise exception 'not the owner';
  end if;
  return code;
end;
$$;

revoke execute on function public.transfer_group_ownership(uuid, uuid) from public, anon;
revoke execute on function public.regenerate_invite_code(uuid) from public, anon;
grant execute on function public.transfer_group_ownership(uuid, uuid) to authenticated;
grant execute on function public.regenerate_invite_code(uuid) to authenticated;

-- 링크 미리보기(카카오톡 등)는 로그인 없이 서버가 비밀 키로 그룹·약속 이름을 읽는다.
grant select on public.groups, public.events to service_role;
