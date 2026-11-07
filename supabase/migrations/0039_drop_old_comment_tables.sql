-- 옛 댓글 표를 지운다. (#25)
-- 0036에서 약속·투표 댓글을 comments 하나로 합치고, 옛 표는 배포 동안 읽기 전용으로 남겨 뒀다.
-- 운영 확인(2026-11-08): 옛 표에만 있는 댓글 0개, 0036 이후 옛 표에 쓰인 행 0개.
--
-- 표를 지우면 그 표의 정책·트리거·권한(워커 읽기 권한 포함)도 함께 지워진다.
-- 옛 표 전용 함수와, 0036에서 트리거를 떼어 낸 뒤 쓰이지 않는 옛 알림 함수도 지운다.
-- (comments_mark_edited는 comments가 그대로 쓰므로 남긴다)

drop table public.event_comments;
drop table public.poll_comments;

drop function public.event_comment_parent_ok(uuid, uuid);
drop function public.poll_comment_parent_ok(uuid, uuid);
drop function public.queue_mention_notifications();
drop function public.queue_comment_notifications();
