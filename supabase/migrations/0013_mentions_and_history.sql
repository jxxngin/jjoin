-- 댓글 @언급, 알림 기록.

-- 1) 댓글에 언급한 사람들. 화면에서 고른 멤버 id를 함께 저장한다.
alter table public.event_comments
  add column mentions uuid[] not null default '{}' check (cardinality(mentions) <= 20);

grant insert (mentions) on public.event_comments to authenticated;

-- 2) 알림 종류에 언급(mention)을 추가하고, 어떤 댓글인지 기억한다.
alter table public.notification_outbox
  drop constraint notification_outbox_kind_check,
  add constraint notification_outbox_kind_check
    check (kind in ('new_event', 'promoted', 'day_before', 'mention')),
  add column comment_id uuid references public.event_comments (id) on delete cascade;

alter table public.profiles add column notify_mention boolean not null default true;
grant update (notify_mention) on public.profiles to authenticated;

-- 3) 알림 기록. 푸시를 꺼 둔 사람도 앱 안에서 볼 수 있게 대기열에 쌓이는 알림을 모두 남긴다.
create table public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  comment_id uuid references public.event_comments (id) on delete cascade,
  kind text not null check (kind in ('new_event', 'promoted', 'day_before', 'mention')),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index notifications_user_id_created_at_idx on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

create policy "본인 알림만 조회"
  on public.notifications for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "본인 알림만 읽음 처리"
  on public.notifications for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, update (read_at) on public.notifications to authenticated;

create function public.record_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications (user_id, event_id, comment_id, kind)
  values (new.user_id, new.event_id, new.comment_id, new.kind);
  return new;
end;
$$;

create trigger notification_outbox_record
  after insert on public.notification_outbox
  for each row execute function public.record_notification();

-- 4) 언급 알림: 그 약속을 볼 수 있는 그룹 멤버에게만, 쓴 사람 본인은 빼고.
create function public.queue_mention_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notification_outbox (user_id, event_id, comment_id, kind)
  select distinct m.user_id, new.event_id, new.id, 'mention'
  from unnest(new.mentions) as mentioned(user_id)
  join public.events e on e.id = new.event_id
  join public.group_members m on m.group_id = e.group_id and m.user_id = mentioned.user_id
  where m.user_id <> new.user_id;
  return new;
end;
$$;

create trigger event_comments_queue_mentions
  after insert on public.event_comments
  for each row execute function public.queue_mention_notifications();

revoke execute on function public.record_notification() from public, anon, authenticated;
revoke execute on function public.queue_mention_notifications() from public, anon, authenticated;

-- 서버(비밀 키)가 언급 알림 문구를 만들 때 댓글 내용과 쓴 사람을 읽는다.
grant select on public.event_comments to service_role;
