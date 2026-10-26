-- 통합 테스트용 최소 스키마. 실제 구조는 supabase/migrations/ (0011·0013·0014·0032)가 기준이고,
-- 워커가 쓰는 표·열만 같은 모양으로 만든다. (Supabase 전용 auth·RLS는 뺐다)
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
  place_name text
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
