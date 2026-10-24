-- 여러 날에 걸친 약속(2박 3일 등)과 기간 투표.
-- - events.ends_at: 여러 날 약속이 끝나는 시각 (마지막 날 다음 날 0시, 한국 시간). 하루 약속이면 null
-- - date_polls.kind: 'day' 당일 투표(날짜·시간 후보) / 'trip' 기간 투표(가는 날~오는 날 후보)
-- - date_poll_options.ends_at: 기간 투표 후보가 끝나는 시각. 당일 투표면 null

alter table public.events
  add column ends_at timestamptz,
  add constraint events_ends_after_start check (ends_at is null or ends_at > starts_at);

-- 기간 약속은 시작이 지나도 끝나기 전까지는 "다가오는" 약속이다.
create index events_ends_at_idx on public.events (ends_at) where ends_at is not null;

-- 약속 수정 권한에 끝나는 시각도 넣는다. (0004의 열 단위 권한과 같은 방식)
grant insert (ends_at), update (ends_at) on public.events to authenticated;

alter table public.date_polls
  add column kind text not null default 'day' check (kind in ('day', 'trip'));

alter table public.date_poll_options
  add column ends_at timestamptz,
  add constraint date_poll_options_ends_after_start check (ends_at is null or ends_at > starts_at),
  drop constraint date_poll_options_poll_id_starts_at_key,
  add constraint date_poll_options_unique unique nulls not distinct (poll_id, starts_at, ends_at);

-- 투표와 후보를 한 번에 만든다. 후보는 2~10개.
-- p_ends는 p_options와 같은 순서의 끝나는 시각 (기간 투표만, 당일 투표는 비워 둔다).
drop function public.create_date_poll(uuid, text, text, text, double precision, double precision, text, int, text, timestamptz[]);

create function public.create_date_poll(
  p_group_id uuid,
  p_title text,
  p_place_name text,
  p_place_address text,
  p_place_lat double precision,
  p_place_lng double precision,
  p_place_url text,
  p_max_people int,
  p_memo text,
  p_options timestamptz[],
  p_kind text default 'day',
  p_ends timestamptz[] default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  new_id uuid;
begin
  if uid is null or not exists (
    select 1 from public.group_members where group_id = p_group_id and user_id = uid
  ) then
    raise exception 'not a member';
  end if;
  if cardinality(p_options) not between 2 and 10 then
    raise exception 'need 2 to 10 options';
  end if;
  if p_kind not in ('day', 'trip') then
    raise exception 'bad kind';
  end if;
  if p_kind = 'trip' and cardinality(p_ends) is distinct from cardinality(p_options) then
    raise exception 'need an end for every option';
  end if;

  insert into public.date_polls (
    group_id, title, place_name, place_address, place_lat, place_lng, place_url, max_people, memo, created_by, kind
  )
  values (
    p_group_id, trim(p_title), p_place_name, p_place_address, p_place_lat, p_place_lng, p_place_url, p_max_people, p_memo, uid, p_kind
  )
  returning id into new_id;

  insert into public.date_poll_options (poll_id, starts_at, ends_at)
  select distinct new_id, o.starts_at, case when p_kind = 'trip' then o.ends_at end
  from unnest(p_options, coalesce(p_ends, array_fill(null::timestamptz, array[cardinality(p_options)])))
    as o(starts_at, ends_at);

  return new_id;
end;
$$;

-- 고른 후보로 약속을 만들고 투표를 닫는다. 기간 후보면 끝나는 시각도 약속에 넣는다.
-- 그 후보에 투표한 사람은 투표한 순서대로 참여(정원이 차면 대기)한다.
create or replace function public.confirm_date_poll(p_poll_id uuid, p_option_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  poll record;
  chosen record;
  new_event uuid;
  voter uuid;
  going int;
begin
  select * into poll from public.date_polls where id = p_poll_id for update;
  if poll.id is null then
    raise exception 'poll not found';
  end if;
  if uid is distinct from poll.created_by and not exists (
    select 1 from public.groups where id = poll.group_id and owner_id = uid
  ) then
    raise exception 'not allowed';
  end if;
  if poll.event_id is not null then
    raise exception 'already confirmed';
  end if;

  select starts_at, ends_at into chosen from public.date_poll_options where id = p_option_id and poll_id = p_poll_id;
  if chosen.starts_at is null then
    raise exception 'option not found';
  end if;

  -- 약속을 만들면 기존 트리거가 만든 사람을 참여시키고 새 약속 알림을 쌓는다.
  insert into public.events (
    group_id, title, starts_at, ends_at, place_name, place_address, place_lat, place_lng, place_url, max_people, memo, created_by
  )
  values (
    poll.group_id, poll.title, chosen.starts_at, chosen.ends_at, poll.place_name, poll.place_address, poll.place_lat,
    poll.place_lng, poll.place_url, poll.max_people, poll.memo, poll.created_by
  )
  returning id into new_event;

  for voter in
    select v.user_id
    from public.date_poll_votes v
    join public.group_members m on m.group_id = poll.group_id and m.user_id = v.user_id
    where v.option_id = p_option_id and v.user_id <> poll.created_by
    order by v.created_at
  loop
    select count(*) into going from public.event_participants where event_id = new_event and status = 'going';
    insert into public.event_participants (event_id, user_id, status)
    values (
      new_event,
      voter,
      case when poll.max_people is null or going < poll.max_people then 'going' else 'waitlisted' end
    )
    on conflict do nothing;
  end loop;

  update public.date_polls
  set closed_at = coalesce(closed_at, now()), event_id = new_event
  where id = p_poll_id;

  return new_event;
end;
$$;

revoke execute on function public.create_date_poll(uuid, text, text, text, double precision, double precision, text, int, text, timestamptz[], text, timestamptz[]) from public, anon;
grant execute on function public.create_date_poll(uuid, text, text, text, double precision, double precision, text, int, text, timestamptz[], text, timestamptz[]) to authenticated;
