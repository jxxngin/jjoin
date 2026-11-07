-- 약속 댓글. 그 약속이 있는 그룹의 멤버만 보고 쓸 수 있고, 지우는 건 쓴 사람만.
create table public.event_comments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);

create index event_comments_event_id_created_at_idx on public.event_comments (event_id, created_at);

alter table public.event_comments enable row level security;

create policy "멤버만 댓글 조회"
  on public.event_comments for select
  to authenticated
  using (public.can_view_event(event_id));

create policy "멤버는 본인 이름으로 댓글 작성"
  on public.event_comments for insert
  to authenticated
  with check (public.can_view_event(event_id) and user_id = (select auth.uid()));

create policy "본인 댓글만 삭제"
  on public.event_comments for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- 작성자(user_id)는 기본값 auth.uid()로만 정해지게 insert 컬럼을 제한한다.
grant select, delete on public.event_comments to authenticated;
grant insert (event_id, body) on public.event_comments to authenticated;
