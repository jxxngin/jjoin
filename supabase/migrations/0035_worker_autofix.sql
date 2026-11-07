-- 백엔드 B3: 자동 수정 연동(/api/autofix/*)을 Spring 워커가 맡는다. (GitHub 작업 → AUTOFIX_SECRET)
-- 지금까지 Next가 관리자 키로 하던 일을 워커 계정에 필요한 열만 열어 준다.
--   - 오류 신고 내용 넘겨주기: 본문·화면 주소 (작성자 정보는 넘기지 않는다)
--   - 결과 받기: auto_fix_status·auto_fix_url
--   - 배포 안내: 처리 완료로 바꾸고(status·deployed_at), 대화에 안내 글을 남긴다
-- 열·정책을 더하기만 하므로 Next 쪽 코드와 상관없이 언제 실행해도 된다.

grant select (body, page_path, user_id, duplicate_of, deployed_at) on public.inquiries to jjoin_worker;
grant update (auto_fix_status, auto_fix_url, status, deployed_at) on public.inquiries to jjoin_worker;

grant insert (inquiry_id, user_id, is_admin, body) on public.inquiry_messages to jjoin_worker;
create policy "알림 워커: 배포 안내 글" on public.inquiry_messages for insert to jjoin_worker with check (is_admin and user_id is null);
