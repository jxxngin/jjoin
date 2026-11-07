-- 투표로 만든 약속을 지우면 그 투표도 함께 지운다. (#23)
-- 지금까지는 date_polls.event_id가 on delete set null(0014)이라, 약속을 지우면 투표의 확정 연결만 비워지고
-- 투표가 '마감 · 확정 대기' 상태로 그룹 화면에 다시 나타났다.
-- 투표 댓글·장소 후보는 확정 때 이미 약속으로 옮겨졌으므로(0021, 0036) 약속과 함께 지워지는 것이 맞다.
alter table public.date_polls
  drop constraint date_polls_event_id_fkey,
  add constraint date_polls_event_id_fkey foreign key (event_id) references public.events (id) on delete cascade;
