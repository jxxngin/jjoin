-- 문의하기. 사용자가 유형·제목·내용으로 문의하고, 관리자가 상태를 바꾸고 답변한다.
-- 1시간마다 관리자에게 카톡으로 요약을 보내고(notified_at), 오류 신고는 자동 수정 작업이 수정안(PR)을 만든다(auto_fix_*).

------------------------------------------------------------
-- 관리자 목록. 행 추가는 SQL Editor에서만 한다. (앱에서는 읽기만)
------------------------------------------------------------
create table public.app_admins (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.app_admins enable row level security;

create function public.is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.app_admins where user_id = (select auth.uid()));
$$;

revoke execute on function public.is_app_admin() from public, anon;
grant execute on function public.is_app_admin() to authenticated;

------------------------------------------------------------
-- 문의
------------------------------------------------------------
create table public.inquiries (
  id uuid primary key default gen_random_uuid(),
  -- 탈퇴해도 문의 기록은 남긴다. (작성자만 비워진다)
  user_id uuid default auth.uid() references public.profiles (id) on delete set null,
  category text not null check (category in ('bug', 'feature', 'usage', 'account', 'other')),
  title text not null check (char_length(title) between 1 and 80),
  body text not null check (char_length(body) between 1 and 2000),
  -- 문의를 연 화면 주소와 기기 정보 (오류 재현용)
  page_path text check (char_length(page_path) <= 300),
  user_agent text check (char_length(user_agent) <= 400),
  status text not null default 'received' check (status in ('received', 'in_progress', 'done')),
  reply text check (char_length(reply) <= 2000),
  replied_at timestamptz,
  created_at timestamptz not null default now(),
  -- 관리자에게 카톡 요약을 보낸 시각 (1시간 요약)
  notified_at timestamptz,
  -- 오류 자동 수정: 대기(pending) · 수정안 만듦(pr_opened) · 고치지 못함(failed) · 대상 아님(skipped)
  auto_fix_status text check (auto_fix_status in ('pending', 'pr_opened', 'failed', 'skipped')),
  auto_fix_url text check (char_length(auto_fix_url) <= 300)
);

create index inquiries_user_id_created_at_idx on public.inquiries (user_id, created_at desc);
create index inquiries_created_at_idx on public.inquiries (created_at desc);

alter table public.inquiries enable row level security;

create policy "본인·관리자만 문의 조회"
  on public.inquiries for select to authenticated
  using (user_id = (select auth.uid()) or public.is_app_admin());

create policy "본인 이름으로 문의 작성"
  on public.inquiries for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "관리자만 상태·답변 변경"
  on public.inquiries for update to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

grant select on public.inquiries to authenticated;
grant insert (category, title, body, page_path, user_agent) on public.inquiries to authenticated;
grant update (status, reply) on public.inquiries to authenticated;
-- 카톡 요약·자동 수정 작업은 서버(비밀 키)가 읽고 표시한다.
grant select, update on public.inquiries to service_role;
grant select on public.app_admins to service_role;

-- 하루에 5건까지. 답변이 바뀌면 답변 시각을 남긴다.
create function public.inquiries_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if (
      select count(*) from public.inquiries
      where user_id = new.user_id and created_at > now() - interval '1 day'
    ) >= 5 then
      raise exception 'too many inquiries';
    end if;
  elsif new.reply is distinct from old.reply then
    new.replied_at := case when new.reply is null then null else now() end;
  end if;
  return new;
end;
$$;

create trigger inquiries_guard
  before insert or update on public.inquiries
  for each row execute function public.inquiries_guard();

revoke execute on function public.inquiries_guard() from public, anon, authenticated;
