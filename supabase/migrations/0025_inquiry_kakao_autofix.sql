-- 문의 알림(카톡 "나에게 보내기")과 오류 자동 수정 보조.

-- 관리자의 카카오 토큰. 1시간 요약을 관리자 본인 카톡(나와의 채팅)으로 보낼 때 쓴다.
-- 서버(비밀 키)만 읽고 쓴다. 사용자는 볼 수 없다. (정책 없음)
create table public.admin_kakao_tokens (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  access_token text not null,
  refresh_token text not null,
  access_expires_at timestamptz not null,
  refresh_expires_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.admin_kakao_tokens enable row level security;

grant select, insert, update, delete on public.admin_kakao_tokens to service_role;

-- 자동 수정 결과(수정안 준비·실패)를 요약에 한 번만 넣으려고 보낸 시각을 남긴다.
alter table public.inquiries add column autofix_notified_at timestamptz;

-- 스팸·시험 문의를 서버에서 지울 수 있게 한다.
grant delete on public.inquiries to service_role;
