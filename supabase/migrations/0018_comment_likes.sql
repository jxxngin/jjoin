-- 댓글 하트. 약속을 볼 수 있는 그룹 멤버가 댓글마다 한 번씩 누를 수 있다.
-- id를 따로 둔다. (comment_id, user_id)를 기본 키로 하면 PostgREST가 이 표를 댓글↔프로필 연결 표로 보고
-- 기존 댓글 조회의 profiles(...)가 "관계가 둘"이라며 실패한다.
create table public.comment_likes (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.event_comments (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (comment_id, user_id)
);

alter table public.comment_likes enable row level security;

-- 그 댓글이 달린 약속을 볼 수 있는지
create function public.can_view_comment(cid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.event_comments c where c.id = cid and public.can_view_event(c.event_id)
  );
$$;

revoke execute on function public.can_view_comment(uuid) from public, anon;
grant execute on function public.can_view_comment(uuid) to authenticated;

create policy "멤버만 하트 조회"
  on public.comment_likes for select to authenticated
  using (public.can_view_comment(comment_id));

create policy "멤버는 본인 이름으로 하트"
  on public.comment_likes for insert to authenticated
  with check (user_id = (select auth.uid()) and public.can_view_comment(comment_id));

create policy "본인 하트만 취소"
  on public.comment_likes for delete to authenticated
  using (user_id = (select auth.uid()));

-- 누른 사람(user_id)은 기본값 auth.uid()로만 정해지게 insert 컬럼을 제한한다.
grant select, delete on public.comment_likes to authenticated;
grant insert (comment_id) on public.comment_likes to authenticated;
