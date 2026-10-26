-- 알림 발송을 Java Spring 워커(backend/)로 옮기는 준비. (PLAN.md §10 B1)
-- 1) 대기열을 "꺼내면서 지우기"에서 "상태를 남기는 대기열"로 바꾼다.
--    대기(pending) → 보내는 중(sending) → 보냄(sent) / 건너뜀(skipped) / 실패(failed)
--    보내지 못하면 시도 횟수와 다음 시도 시각을 남겨 다시 보낸다. (지금은 실패하면 그 알림이 사라진다)
-- 2) 워커 전용 DB 계정 jjoin_worker. 관리자 키 대신, 알림 발송에 필요한 표·열만 읽고 쓴다.
--    비밀번호는 이 파일에 넣지 않는다. SQL Editor에서 따로 정한다:
--      alter role jjoin_worker password '<긴 임의 문자열>';

------------------------------------------------------------
-- 1. 대기열 상태
------------------------------------------------------------
alter table public.notification_outbox
  add column status text not null default 'pending'
    check (status in ('pending', 'sending', 'sent', 'skipped', 'failed')),
  add column attempts integer not null default 0,
  add column next_attempt_at timestamptz not null default now(),
  -- 보내는 중으로 잡은 시각. 워커가 죽어 오래 'sending'에 머문 행을 다시 대기로 돌린다.
  add column locked_at timestamptz,
  add column sent_at timestamptz,
  add column last_error text check (char_length(last_error) <= 500);

-- 보낼 차례인 행만 빠르게 찾는다.
create index notification_outbox_ready_idx on public.notification_outbox (next_attempt_at, id) where status = 'pending';
create index notification_outbox_sending_idx on public.notification_outbox (locked_at) where status = 'sending';

------------------------------------------------------------
-- 2. 워커 전용 계정
------------------------------------------------------------
create role jjoin_worker login noinherit;

grant usage on schema public to jjoin_worker;
grant select, update, delete on public.notification_outbox to jjoin_worker;
grant select, delete on public.push_subscriptions to jjoin_worker;
-- 알림 문구에 필요한 열만
grant select (id, group_id, title, starts_at, ends_at, place_name) on public.events to jjoin_worker;
grant select (id, name) on public.groups to jjoin_worker;
grant select (id, user_id, body) on public.event_comments to jjoin_worker;
grant select (
  id, nickname,
  notify_new_event, notify_promoted, notify_day_before, notify_mention, notify_hour_before, notify_comment
) on public.profiles to jjoin_worker;

-- 모든 표에 RLS가 켜져 있으므로 워커가 쓸 수 있는 범위를 정책으로 연다.
create policy "알림 워커: 대기열" on public.notification_outbox for all to jjoin_worker using (true) with check (true);
create policy "알림 워커: 구독 읽기" on public.push_subscriptions for select to jjoin_worker using (true);
create policy "알림 워커: 만료 구독 지우기" on public.push_subscriptions for delete to jjoin_worker using (true);
create policy "알림 워커: 약속 읽기" on public.events for select to jjoin_worker using (true);
create policy "알림 워커: 그룹 읽기" on public.groups for select to jjoin_worker using (true);
create policy "알림 워커: 댓글 읽기" on public.event_comments for select to jjoin_worker using (true);
create policy "알림 워커: 프로필 읽기" on public.profiles for select to jjoin_worker using (true);
