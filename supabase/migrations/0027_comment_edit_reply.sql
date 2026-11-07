-- 댓글 수정·답글과 투표 댓글 언급. (문의: "댓글 수정 기능", "댓글 답글 기능", "투표 기능 내 댓글 태그")
-- - parent_id: 답글이면 원래 댓글. 답글의 답글은 만들지 않는다(한 단계만).
-- - edited_at: 내용을 고친 시각. 고치면 "(수정됨)"을 붙인다.
-- - poll_comments.mentions: 투표 댓글에서 @로 부른 멤버 (알림은 서버가 바로 푸시로 보낸다)

alter table public.event_comments
  add column parent_id uuid references public.event_comments (id) on delete cascade,
  add column edited_at timestamptz;

alter table public.poll_comments
  add column parent_id uuid references public.poll_comments (id) on delete cascade,
  add column edited_at timestamptz,
  add column mentions uuid[] not null default '{}' check (cardinality(mentions) <= 20);

create index event_comments_parent_id_idx on public.event_comments (parent_id) where parent_id is not null;
create index poll_comments_parent_id_idx on public.poll_comments (parent_id) where parent_id is not null;

-- 답글의 원래 댓글이 같은 약속(투표)의 '원 댓글'인지. 정책에서 같은 표를 다시 읽으면 RLS가 반복되므로 함수로 확인한다.
create function public.event_comment_parent_ok(p_parent uuid, p_event uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_parent is null or exists (
    select 1 from public.event_comments c
    where c.id = p_parent and c.event_id = p_event and c.parent_id is null
  );
$$;

create function public.poll_comment_parent_ok(p_parent uuid, p_poll uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_parent is null or exists (
    select 1 from public.poll_comments c
    where c.id = p_parent and c.poll_id = p_poll and c.parent_id is null
  );
$$;

revoke execute on function public.event_comment_parent_ok(uuid, uuid) from public, anon;
revoke execute on function public.poll_comment_parent_ok(uuid, uuid) from public, anon;
grant execute on function public.event_comment_parent_ok(uuid, uuid) to authenticated;
grant execute on function public.poll_comment_parent_ok(uuid, uuid) to authenticated;

-- 쓰기 정책에 답글 확인을 더한다.
drop policy "멤버는 본인 이름으로 댓글 작성" on public.event_comments;
create policy "멤버는 본인 이름으로 댓글 작성"
  on public.event_comments for insert to authenticated
  with check (
    public.can_view_event(event_id)
    and user_id = (select auth.uid())
    and public.event_comment_parent_ok(parent_id, event_id)
  );

drop policy "멤버는 본인 이름으로 투표 댓글 작성" on public.poll_comments;
create policy "멤버는 본인 이름으로 투표 댓글 작성"
  on public.poll_comments for insert to authenticated
  with check (
    public.can_view_poll(poll_id)
    and user_id = (select auth.uid())
    and public.poll_comment_parent_ok(parent_id, poll_id)
  );

-- 본인 댓글만 내용을 고친다.
create policy "본인 댓글만 수정"
  on public.event_comments for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "본인 투표 댓글만 수정"
  on public.poll_comments for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant insert (parent_id) on public.event_comments to authenticated;
grant update (body) on public.event_comments to authenticated;
grant insert (parent_id, mentions) on public.poll_comments to authenticated;
grant update (body) on public.poll_comments to authenticated;

-- 내용이 바뀌면 고친 시각을 남긴다.
create function public.comments_mark_edited()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.body is distinct from old.body then
    new.edited_at := now();
  end if;
  return new;
end;
$$;

create trigger event_comments_mark_edited
  before update on public.event_comments
  for each row execute function public.comments_mark_edited();

create trigger poll_comments_mark_edited
  before update on public.poll_comments
  for each row execute function public.comments_mark_edited();

-- 투표 댓글 언급 알림을 보낼 때 서버가 받을 사람의 알림 설정을 읽는다.
grant select on public.poll_comments to service_role;
