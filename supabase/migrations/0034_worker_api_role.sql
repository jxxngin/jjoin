-- 백엔드 B3: Spring API가 사용자 요청을 그 사용자의 권한(RLS)으로 처리한다.
-- Spring은 Supabase 로그인 토큰을 검증한 뒤, 트랜잭션마다
--   select set_config('request.jwt.claims', <토큰 내용>, true); set local role authenticated;
-- 를 하고 SQL을 실행한다. Supabase API(PostgREST)와 같은 방식이라 auth.uid()와 기존 RLS 정책이 그대로 적용된다.
--
-- jjoin_worker는 noinherit라 평소에는 authenticated 권한이 없고, set role 했을 때만 생긴다.
-- (알림 발송·예약 작업은 지금처럼 워커 전용 권한으로만 돈다)
-- 이미 적용돼 있으면 아무 일도 하지 않는다.

grant authenticated to jjoin_worker;
