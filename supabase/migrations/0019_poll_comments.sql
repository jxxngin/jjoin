------------------------------------------------------------
-- 날짜 투표 댓글: 투표를 볼 수 있는 그룹 멤버가 쓰고, 지우는 건 쓴 사람만.
------------------------------------------------------------
create table public.poll_comments (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.date_polls (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);

create index poll_comments_poll_id_created_at_idx on public.poll_comments (poll_id, created_at);

alter table public.poll_comments enable row level security;

create policy "멤버만 투표 댓글 조회"
  on public.poll_comments for select to authenticated
  using (public.can_view_poll(poll_id));

create policy "멤버는 본인 이름으로 투표 댓글 작성"
  on public.poll_comments for insert to authenticated
  with check (public.can_view_poll(poll_id) and user_id = (select auth.uid()));

create policy "본인 투표 댓글만 삭제"
  on public.poll_comments for delete to authenticated
  using (user_id = (select auth.uid()));

grant select, delete on public.poll_comments to authenticated;
grant insert (poll_id, body) on public.poll_comments to authenticated;
