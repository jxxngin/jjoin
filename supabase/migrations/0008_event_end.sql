-- 상태 단순화: 모집중 / 마감 / 종료. 최소 인원은 쓰지 않는다.
alter table public.events drop column min_people;

-- 시작 전에 만든 사람·방장이 직접 종료할 수 있다. 사유는 고정 목록 + 기타 메모.
-- 시간이 지나 끝난 약속은 저장하지 않고 화면에서 "기간 종료"로 계산한다.
alter table public.events
  add column ended_at timestamptz,
  add column end_reason text check (
    end_reason in ('not_enough_people', 'cancelled', 'schedule_conflict', 'weather', 'other')
  ),
  add column end_note text check (char_length(end_note) <= 100),
  add constraint events_end_reason_required check ((ended_at is null) = (end_reason is null));

grant update (ended_at, end_reason, end_note) on public.events to authenticated;

-- 종료된 약속은 참여 상태를 바꿀 수 없다. (0005의 함수에 종료 확인만 추가)
create or replace function public.set_participation(eid uuid, new_status text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  ev record;
  prev text;
  going int;
  result text := new_status;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  if new_status not in ('going', 'maybe', 'not_going') then
    raise exception 'invalid status';
  end if;

  -- 같은 약속에 동시에 신청해도 정원을 넘지 않도록 약속 행을 잠근다.
  select id, group_id, starts_at, max_people, ended_at into ev
  from public.events where id = eid
  for update;

  if ev.id is null or not exists (
    select 1 from public.group_members where group_id = ev.group_id and user_id = uid
  ) then
    raise exception 'event not found';
  end if;
  if ev.starts_at < now() or ev.ended_at is not null then
    raise exception 'event already ended';
  end if;

  select status into prev
  from public.event_participants
  where event_id = eid and user_id = uid;

  if new_status = 'going' then
    -- 이미 참여 중이거나 대기 중이면 순서를 유지한다.
    if prev in ('going', 'waitlisted') then
      return prev;
    end if;

    select count(*) into going
    from public.event_participants
    where event_id = eid and status = 'going';

    if ev.max_people is not null and going >= ev.max_people then
      result := 'waitlisted';
    end if;
  end if;

  insert into public.event_participants (event_id, user_id, status, updated_at)
  values (eid, uid, result, now())
  on conflict (event_id, user_id)
  do update set status = excluded.status, updated_at = excluded.updated_at;

  if prev = 'going' and result <> 'going' then
    perform public.promote_waitlist(eid);
  end if;

  return result;
end;
$$;
