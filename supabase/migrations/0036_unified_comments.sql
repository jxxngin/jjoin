-- 약속 댓글과 투표 댓글을 표 하나(comments)로 합친다. (#7)
-- 투표 중이든 약속이 정해진 뒤든 댓글 기능(하트, @언급, 답글, 수정, 알림, 안 읽은 숫자)이 똑같고,
-- 앞으로 댓글 기능을 고치면 이 표 하나만 바꾸면 된다.
--
-- - comments: event_id 또는 poll_id 중 하나에 달린다. 기존 두 표의 댓글을 id 그대로 옮긴다.
-- - 하트(comment_likes), 알림 대기열·기록의 comment_id가 comments를 가리키게 바꾼다.
-- - 알림 대기열·기록에 poll_id를 더해 투표 댓글의 언급·새 댓글 알림도 약속과 같은 길로 보낸다.
--   새 댓글 알림은 투표를 만든 사람과 투표한 사람에게 간다. (약속: 만든 사람과 참여·대기·미정인 사람)
-- - poll_seen: 투표를 본 시각 (투표 카드의 안 읽은 댓글 숫자)
-- - 투표가 약속으로 확정되면 댓글과 그 알림이 약속으로 옮겨 간다. 이미 확정된 투표의 댓글과
--   확정 뒤에 늦게 도착한 투표 댓글도 약속으로 간다.
-- - 예전 표(event_comments, poll_comments)는 이번 배포 동안 읽기만 되게 두고 다음 마이그레이션에서 지운다.

------------------------------------------------------------
-- 1. 댓글 표
------------------------------------------------------------
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events (id) on delete cascade,
  poll_id uuid references public.date_polls (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  -- 답글이면 원래 댓글. 답글의 답글은 만들지 않는다(한 단계만).
  parent_id uuid references public.comments (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  mentions uuid[] not null default '{}' check (cardinality(mentions) <= 20),
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  constraint comments_target_check check (num_nonnulls(event_id, poll_id) = 1)
);

create index comments_event_id_created_at_idx on public.comments (event_id, created_at) where event_id is not null;
create index comments_poll_id_created_at_idx on public.comments (poll_id, created_at) where poll_id is not null;
create index comments_parent_id_idx on public.comments (parent_id) where parent_id is not null;

-- 기존 댓글을 id 그대로 옮긴다. (트리거를 달기 전이라 알림이 다시 가지 않는다)
insert into public.comments (id, event_id, user_id, parent_id, body, mentions, created_at, edited_at)
select id, event_id, user_id, parent_id, body, mentions, created_at, edited_at from public.event_comments;

insert into public.comments (id, poll_id, user_id, parent_id, body, mentions, created_at, edited_at)
select id, poll_id, user_id, parent_id, body, mentions, created_at, edited_at from public.poll_comments;

-- 이미 약속으로 확정된 투표의 댓글은 바로 그 약속으로 잇는다. (확정된 투표 화면은 댓글 대신 약속 링크를 보여 준다)
update public.comments c
set event_id = d.event_id, poll_id = null
from public.date_polls d
where c.poll_id = d.id and d.event_id is not null;

------------------------------------------------------------
-- 2. 권한 (RLS)
------------------------------------------------------------
alter table public.comments enable row level security;

-- 댓글이 달린 약속·투표를 볼 수 있는지 (그 그룹의 멤버인지)
create function public.can_view_comment_target(p_event uuid, p_poll uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_event is not null then public.can_view_event(p_event)
    else public.can_view_poll(p_poll)
  end;
$$;

-- 답글의 원래 댓글이 같은 약속·투표의 '원 댓글'인지. 정책에서 같은 표를 다시 읽으면 RLS가 반복되므로 함수로 확인한다.
create function public.comment_parent_ok(p_parent uuid, p_event uuid, p_poll uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_parent is null or exists (
    select 1 from public.comments c
    where c.id = p_parent
      and c.parent_id is null
      and c.event_id is not distinct from p_event
      and c.poll_id is not distinct from p_poll
  );
$$;

revoke execute on function public.can_view_comment_target(uuid, uuid) from public, anon;
revoke execute on function public.comment_parent_ok(uuid, uuid, uuid) from public, anon;
grant execute on function public.can_view_comment_target(uuid, uuid) to authenticated;
grant execute on function public.comment_parent_ok(uuid, uuid, uuid) to authenticated;

create policy "멤버만 댓글 조회"
  on public.comments for select to authenticated
  using (public.can_view_comment_target(event_id, poll_id));

create policy "멤버는 본인 이름으로 댓글 작성"
  on public.comments for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.can_view_comment_target(event_id, poll_id)
    and public.comment_parent_ok(parent_id, event_id, poll_id)
  );

create policy "본인 댓글만 수정"
  on public.comments for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "본인 댓글만 삭제"
  on public.comments for delete to authenticated
  using (user_id = (select auth.uid()));

-- 작성자(user_id)는 기본값 auth.uid()로만 정해지게 쓰는 열을 제한한다. 내용만 고칠 수 있다.
grant select, delete on public.comments to authenticated;
grant insert (event_id, poll_id, parent_id, body, mentions) on public.comments to authenticated;
grant update (body) on public.comments to authenticated;
-- 서버(비밀 키)가 알림 문구를 만들 때 댓글 내용과 쓴 사람을 읽는다. (Next의 예비 발송 경로)
grant select on public.comments to service_role;

-- 내용이 바뀌면 고친 시각을 남긴다. (0027의 함수를 그대로 쓴다)
create trigger comments_mark_edited
  before update on public.comments
  for each row execute function public.comments_mark_edited();

------------------------------------------------------------
-- 3. 하트: 투표 댓글에도
------------------------------------------------------------
alter table public.comment_likes
  drop constraint comment_likes_comment_id_fkey,
  add constraint comment_likes_comment_id_fkey foreign key (comment_id) references public.comments (id) on delete cascade;

create or replace function public.can_view_comment(cid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.comments c
    where c.id = cid and public.can_view_comment_target(c.event_id, c.poll_id)
  );
$$;

------------------------------------------------------------
-- 4. 알림 대기열·기록: 투표 댓글도 담는다
------------------------------------------------------------
alter table public.notification_outbox
  drop constraint notification_outbox_comment_id_fkey,
  add constraint notification_outbox_comment_id_fkey foreign key (comment_id) references public.comments (id) on delete cascade,
  alter column event_id drop not null,
  add column poll_id uuid references public.date_polls (id) on delete cascade,
  add constraint notification_outbox_target_check check (event_id is not null or poll_id is not null);

alter table public.notifications
  drop constraint notifications_comment_id_fkey,
  add constraint notifications_comment_id_fkey foreign key (comment_id) references public.comments (id) on delete cascade,
  add column poll_id uuid references public.date_polls (id) on delete cascade,
  drop constraint notifications_target_check,
  add constraint notifications_target_check check (event_id is not null or poll_id is not null or inquiry_id is not null);

create index notifications_poll_id_idx on public.notifications (poll_id) where poll_id is not null;

create or replace function public.record_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications (user_id, event_id, poll_id, comment_id, kind)
  values (new.user_id, new.event_id, new.poll_id, new.comment_id, new.kind);
  return new;
end;
$$;

-- 언급 알림: 그 약속·투표를 볼 수 있는 그룹 멤버에게만, 쓴 사람 본인은 빼고.
create function public.queue_comment_mentions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notification_outbox (user_id, event_id, poll_id, comment_id, kind)
  select distinct m.user_id, new.event_id, new.poll_id, new.id, 'mention'
  from unnest(new.mentions) as mentioned(user_id)
  join public.group_members m on m.user_id = mentioned.user_id
  where m.user_id <> new.user_id
    and m.group_id = coalesce(
      (select e.group_id from public.events e where e.id = new.event_id),
      (select p.group_id from public.date_polls p where p.id = new.poll_id)
    );
  return new;
end;
$$;

-- 새 댓글 알림. 쓴 사람과 언급된 사람(언급 알림을 따로 받음)은 뺀다.
-- - 약속: 만든 사람과 참여·대기·미정인 사람
-- - 투표: 만든 사람과 투표한 사람 (날짜 후보에 한 번이라도 투표한 사람)
-- 그룹을 나가거나 내보내진 사람은 참여·투표 기록이 남아 있어도 빼서, 볼 수 없는 대화가 알림으로 새지 않게 한다.
create function public.queue_comment_replies()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notification_outbox (user_id, event_id, poll_id, comment_id, kind)
  select distinct target.user_id, new.event_id, new.poll_id, new.id, 'comment'
  from (
    select e.created_by as user_id from public.events e where e.id = new.event_id
    union
    select p.user_id from public.event_participants p
    where p.event_id = new.event_id and p.status in ('going', 'waitlisted', 'maybe')
    union
    select d.created_by from public.date_polls d where d.id = new.poll_id
    union
    select v.user_id from public.date_poll_votes v
    join public.date_poll_options o on o.id = v.option_id
    where o.poll_id = new.poll_id
  ) as target
  join public.group_members m on m.user_id = target.user_id
  where target.user_id <> new.user_id
    and not (target.user_id = any (new.mentions))
    and m.group_id = coalesce(
      (select e.group_id from public.events e where e.id = new.event_id),
      (select d.group_id from public.date_polls d where d.id = new.poll_id)
    );
  return new;
end;
$$;

-- 이미 약속으로 확정된 투표에 댓글을 쓰면(확정 직전에 연 화면에서 늦게 보낸 경우) 그 약속의 댓글로 저장한다.
-- 투표 행을 잠그고 확인해서, 확정(confirm_date_poll은 투표 행을 FOR UPDATE로 잠근다)과 동시에 와도
-- "확정 전에 저장 → 확정 때 옮겨짐" 또는 "확정 뒤에 저장 → 여기서 약속으로" 중 하나가 된다.
-- RLS 쓰기 검사는 이 트리거 다음에 바뀐 행으로 한다.
create function public.redirect_confirmed_poll_comment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  confirmed uuid;
begin
  if new.poll_id is not null then
    select d.event_id into confirmed from public.date_polls d where d.id = new.poll_id for share;
    if confirmed is not null then
      new.event_id := confirmed;
      new.poll_id := null;
    end if;
  end if;
  return new;
end;
$$;

create trigger comments_redirect_confirmed_poll
  before insert on public.comments
  for each row execute function public.redirect_confirmed_poll_comment();

revoke execute on function public.redirect_confirmed_poll_comment() from public, anon, authenticated;

create trigger comments_queue_mentions
  after insert on public.comments
  for each row execute function public.queue_comment_mentions();

create trigger comments_queue_replies
  after insert on public.comments
  for each row execute function public.queue_comment_replies();

revoke execute on function public.queue_comment_mentions() from public, anon, authenticated;
revoke execute on function public.queue_comment_replies() from public, anon, authenticated;

------------------------------------------------------------
-- 5. 투표를 본 시각 (투표 카드의 안 읽은 댓글 숫자)
------------------------------------------------------------
create table public.poll_seen (
  user_id uuid not null references public.profiles (id) on delete cascade,
  poll_id uuid not null references public.date_polls (id) on delete cascade,
  seen_at timestamptz not null default now(),
  primary key (user_id, poll_id)
);

create index poll_seen_poll_id_idx on public.poll_seen (poll_id);
alter table public.poll_seen enable row level security;

create policy "본인 기록만 조회"
  on public.poll_seen for select to authenticated
  using (user_id = (select auth.uid()));

grant select on public.poll_seen to authenticated;

-- 투표를 봤다고 기록한다. (mark_event_seen과 같다) 그룹 멤버가 아니면 아무것도 하지 않는다.
create function public.mark_poll_seen(p_poll_id uuid, p_at timestamptz default null)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.poll_seen (user_id, poll_id, seen_at)
  select (select auth.uid()), d.id, least(coalesce(p_at, now()), now())
  from public.date_polls d
  join public.group_members m on m.group_id = d.group_id and m.user_id = (select auth.uid())
  where d.id = p_poll_id
  on conflict (user_id, poll_id)
  do update set seen_at = greatest(public.poll_seen.seen_at, excluded.seen_at);
$$;

revoke execute on function public.mark_poll_seen(uuid, timestamptz) from public, anon;
grant execute on function public.mark_poll_seen(uuid, timestamptz) to authenticated;

-- 지금까지의 투표는 모두 본 것으로 시작한다. (안 그러면 지난 투표 댓글이 전부 안 읽음으로 뜬다)
insert into public.poll_seen (user_id, poll_id, seen_at)
select m.user_id, d.id, now()
from public.date_polls d
join public.group_members m on m.group_id = d.group_id
on conflict do nothing;

------------------------------------------------------------
-- 6. 투표가 약속으로 확정되면 댓글과 그 알림을 약속으로 옮긴다
------------------------------------------------------------
create function public.move_poll_comments_to_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.comments set event_id = new.event_id, poll_id = null where poll_id = new.id;
  update public.notifications set event_id = new.event_id, poll_id = null
  where poll_id = new.id and comment_id is not null;
  -- 아직 보내지 않았거나 다시 보낼 알림도 약속으로 (누르면 약속 화면으로 가게)
  update public.notification_outbox set event_id = new.event_id, poll_id = null
  where poll_id = new.id;
  -- 투표 때 댓글을 본 사람은 약속에서도 본 것으로 친다.
  insert into public.event_seen (user_id, event_id, seen_at)
  select s.user_id, new.event_id, s.seen_at from public.poll_seen s where s.poll_id = new.id
  on conflict (user_id, event_id) do update set seen_at = greatest(public.event_seen.seen_at, excluded.seen_at);
  return new;
end;
$$;

create trigger date_polls_move_comments
  after update of event_id on public.date_polls
  for each row
  when (old.event_id is null and new.event_id is not null)
  execute function public.move_poll_comments_to_event();

revoke execute on function public.move_poll_comments_to_event() from public, anon, authenticated;

------------------------------------------------------------
-- 7. 알림 워커(Spring)가 읽는 열
------------------------------------------------------------
grant select (id, user_id, body) on public.comments to jjoin_worker;
grant select (id, group_id, title) on public.date_polls to jjoin_worker;
create policy "알림 워커: 댓글 읽기" on public.comments for select to jjoin_worker using (true);
create policy "알림 워커: 투표 읽기" on public.date_polls for select to jjoin_worker using (true);

------------------------------------------------------------
-- 8. 예전 표는 이번 배포 동안 읽기만 (새 화면이 뜨기 전 잠깐 동안 옛 화면에서 쓴 댓글이 사라지지 않게)
------------------------------------------------------------
drop trigger event_comments_queue_mentions on public.event_comments;
drop trigger event_comments_queue_comments on public.event_comments;
-- 표 단위 회수는 열 단위 권한도 함께 회수하지만(PostgreSQL REVOKE 설명), 0012·0013·0019·0027에서
-- 열 단위로 준 쓰기 권한을 확실히 하기 위해 그 열들도 적어서 회수한다.
revoke insert, update, delete on public.event_comments from authenticated;
revoke insert, update, delete on public.poll_comments from authenticated;
revoke insert (event_id, body, mentions, parent_id), update (body) on public.event_comments from authenticated;
revoke insert (poll_id, body, mentions, parent_id), update (body) on public.poll_comments from authenticated;
