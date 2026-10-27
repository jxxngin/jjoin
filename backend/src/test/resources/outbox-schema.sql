-- 통합 테스트용 최소 스키마. 실제 구조는 supabase/migrations/ (0011·0013·0014·0024·0028·0032)가 기준이고,
-- 워커가 쓰는 표·열·함수만 같은 모양으로 만든다. (Supabase 전용 auth·RLS는 뺐다)
create table public.profiles (
  id uuid primary key,
  nickname text not null,
  notify_new_event boolean not null default true,
  notify_promoted boolean not null default true,
  notify_day_before boolean not null default true,
  notify_mention boolean not null default true,
  notify_hour_before boolean not null default true,
  notify_comment boolean not null default true
);

create table public.groups (
  id uuid primary key,
  name text not null
);

create table public.events (
  id uuid primary key,
  group_id uuid not null references public.groups (id) on delete cascade,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  place_name text,
  ended_at timestamptz,
  day_before_sent_at timestamptz,
  hour_before_sent_at timestamptz
);

create table public.event_participants (
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null check (status in ('going', 'waitlisted', 'maybe', 'not_going')),
  primary key (event_id, user_id)
);

create table public.event_comments (
  id uuid primary key,
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid references public.profiles (id),
  body text not null
);

create table public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  p256dh text not null,
  auth text not null
);

create table public.notification_outbox (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  event_id uuid references public.events (id) on delete cascade,
  comment_id uuid references public.event_comments (id) on delete cascade,
  kind text not null,
  created_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'skipped', 'failed')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  sent_at timestamptz,
  last_error text check (char_length(last_error) <= 500)
);

-- 하루 전·1시간 전 알림을 쌓는 함수 (0011·0014와 같은 본문)
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

-- 문의 요약에 쓰는 열만 (0024·0025·0028)
create table public.inquiries (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  title text not null,
  status text not null default 'received',
  done_at timestamptz,
  user_agent text,
  created_at timestamptz not null default now(),
  auto_fix_status text,
  notified_at timestamptz,
  autofix_notified_at timestamptz
);

create table public.client_errors (
  id bigint generated always as identity primary key,
  message text not null,
  created_at timestamptz not null default now()
);

create table public.app_admins (
  user_id uuid primary key references public.profiles (id) on delete cascade
);
