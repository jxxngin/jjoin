-- 예약 작업을 Java Spring 워커(backend/)로 옮기는 준비. (PLAN.md §10 B2)
-- 워커 전용 계정 jjoin_worker(0032)에 아래 작업에 필요한 권한만 더 준다.
-- 1) 하루 전·1시간 전 알림: 대기열에 쌓는 SQL 함수 실행 (같은 약속은 한 번만 쌓이도록 함수가 표시를 남긴다)
-- 2) 문의 1시간 요약: 새 문의·자동 수정 결과·화면 오류 수를 읽어 관리자에게 푸시, 보낸 표시
-- 3) 오래된 기록 정리: 처리 완료 90일 지난 문의의 기기 정보, 30일 지난 화면 오류

------------------------------------------------------------
-- 1. 하루 전·1시간 전 알림
------------------------------------------------------------
grant execute on function public.queue_day_before_notifications() to jjoin_worker;
grant execute on function public.queue_hour_before_notifications() to jjoin_worker;

------------------------------------------------------------
-- 2·3. 문의 요약과 정리
------------------------------------------------------------
grant select (id, category, title, status, done_at, user_agent, created_at, auto_fix_status, notified_at, autofix_notified_at)
  on public.inquiries to jjoin_worker;
grant update (notified_at, autofix_notified_at, user_agent) on public.inquiries to jjoin_worker;
grant select (id, created_at), delete on public.client_errors to jjoin_worker;
grant select (user_id) on public.app_admins to jjoin_worker;

create policy "알림 워커: 문의 읽기" on public.inquiries for select to jjoin_worker using (true);
create policy "알림 워커: 문의 요약 표시" on public.inquiries for update to jjoin_worker using (true) with check (true);
create policy "알림 워커: 화면 오류 읽기" on public.client_errors for select to jjoin_worker using (true);
create policy "알림 워커: 화면 오류 정리" on public.client_errors for delete to jjoin_worker using (true);
create policy "알림 워커: 관리자 목록" on public.app_admins for select to jjoin_worker using (true);
