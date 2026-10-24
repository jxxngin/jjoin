-- 날짜 투표 공유 링크. 그룹 밖 사람에게 보여 줄 제목·후보 수와 카톡 미리보기를 서버(비밀 키)가 읽는다.
-- (약속 공유 링크·미리보기가 events를 읽는 것과 같은 범위. 0011 참고)
grant select on public.date_polls, public.date_poll_options to service_role;
