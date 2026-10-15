-- 친구 테스트 체크리스트(public/test.html) 결과.
-- 로그인 없이 쓰는 페이지라 사용자는 직접 읽고 쓰지 못하고, 서버(/api/test-report)만 비밀 키로 저장한다.
create table public.test_reports (
  id uuid primary key, -- 기기마다 브라우저가 만든 아이디. 같은 기기에서 고치면 덮어쓴다.
  name text,
  device text,
  browser text,
  answers jsonb not null default '{}'::jsonb, -- { "설치·로그인 / 카카오로 로그인이 된다": { "v": "bad", "memo": "..." } }
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.test_reports enable row level security;

grant select, insert, update on public.test_reports to service_role;
