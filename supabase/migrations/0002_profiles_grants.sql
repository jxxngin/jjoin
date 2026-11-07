-- 새 테이블에 기본 권한이 자동으로 주어지지 않으므로 직접 준다.
-- 실제로 볼 수 있는 행은 RLS 정책이 제한한다.
grant select, update (nickname, avatar_url) on public.profiles to authenticated;
