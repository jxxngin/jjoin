-- 웹 푸시 알림.
-- 알림을 보낼 일이 생기면 DB가 notification_outbox에 쌓고, 서버(비밀 키)가 꺼내 보낸다.
-- 구독 정보와 outbox는 서버 전용이라 사용자(authenticated)에게는 권한을 주지 않는다.

-- 기기별 푸시 구독. 같은 기기에서 다른 계정으로 로그인하면 user_id만 바뀐다.
create table public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index push_subscriptions_user_id_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;

-- 보낼 알림 대기열
create table public.notification_outbox (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  kind text not null check (kind in ('new_event', 'promoted', 'day_before')),
  created_at timestamptz not null default now()
);

alter table public.notification_outbox enable row level security;

-- 종류별 알림 받기 설정. 본인만 바꾼다. (profiles의 update 정책)
alter table public.profiles
  add column notify_new_event boolean not null default true,
  add column notify_promoted boolean not null default true,
  add column notify_day_before boolean not null default true;

grant update (notify_new_event, notify_promoted, notify_day_before) on public.profiles to authenticated;

-- 하루 전 알림을 이미 보냈는지
alter table public.events add column day_before_sent_at timestamptz;

-- 새 약속: 만든 사람을 뺀 그룹 멤버에게
create function public.queue_new_event_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notification_outbox (user_id, event_id, kind)
  select m.user_id, new.id, 'new_event'
  from public.group_members m
  where m.group_id = new.group_id and m.user_id <> new.created_by;
  return new;
end;
$$;

create trigger events_queue_new_event_notifications
  after insert on public.events
  for each row execute function public.queue_new_event_notifications();

-- 대기 승격 알림을 쌓도록 0005의 함수를 다시 만든다. (승격 로직은 그대로)
create or replace function public.promote_waitlist(eid uuid)
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

    insert into public.notification_outbox (user_id, event_id, kind)
    values (next_user, eid, 'promoted');
  end loop;
end;
$$;

-- 하루 전 알림: 내일(한국 날짜) 시작하고 종료되지 않은 약속의 참여자에게. 하루 한 번 Cron이 부른다.
create function public.queue_day_before_notifications()
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
    returning e.id
  )
  insert into public.notification_outbox (user_id, event_id, kind)
  select p.user_id, t.id, 'day_before'
  from targets t
  join public.event_participants p on p.event_id = t.id and p.status = 'going';

  get diagnostics queued = row_count;
  return queued;
end;
$$;

revoke execute on function public.queue_new_event_notifications() from public, anon, authenticated;
revoke execute on function public.queue_day_before_notifications() from public, anon, authenticated;

-- 서버(비밀 키 = service_role)가 알림을 보내는 데 필요한 권한
grant select, insert, update, delete on public.push_subscriptions to service_role;
grant select, delete on public.notification_outbox to service_role;
grant select on public.events, public.groups, public.profiles to service_role;
grant execute on function public.queue_day_before_notifications() to service_role;
