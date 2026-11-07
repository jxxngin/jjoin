-- "마지막으로 본 시각"을 사람별로 서버에 저장한다.
-- 예전에는 기기(브라우저)마다 따로 저장해서, 휴대폰에서 읽은 댓글이 PC나 다른 브라우저에서는 안 읽음으로 남았다.
-- - event_seen: 약속을 본 시각 (약속 카드의 안 읽은 댓글 숫자, 그룹 새 소식)
-- - group_seen: 그룹 화면을 본 시각 (홈 그룹 동그라미의 새 소식 테두리)

create table public.event_seen (
  user_id uuid not null references public.profiles (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  seen_at timestamptz not null default now(),
  primary key (user_id, event_id)
);

create table public.group_seen (
  user_id uuid not null references public.profiles (id) on delete cascade,
  group_id uuid not null references public.groups (id) on delete cascade,
  seen_at timestamptz not null default now(),
  primary key (user_id, group_id)
);

create index event_seen_event_id_idx on public.event_seen (event_id);
create index group_seen_group_id_idx on public.group_seen (group_id);

alter table public.event_seen enable row level security;
alter table public.group_seen enable row level security;

-- 내 기록만 읽는다. 쓰기는 아래 함수로만 한다.
create policy "본인 기록만 조회"
  on public.event_seen for select to authenticated
  using (user_id = (select auth.uid()));

create policy "본인 기록만 조회"
  on public.group_seen for select to authenticated
  using (user_id = (select auth.uid()));

grant select on public.event_seen, public.group_seen to authenticated;

-- 약속을 봤다고 기록한다. 시각은 서버 시계를 쓰므로 기기 시계가 틀려도 상관없다.
-- p_at을 주면 그 시각까지만 본 것으로 친다. (알림 목록에서 댓글 일부만 읽었을 때)
-- 이미 더 늦은 시각이 있으면 되돌리지 않는다. 그룹 멤버가 아니면 아무것도 하지 않는다.
create function public.mark_event_seen(p_event_id uuid, p_at timestamptz default null)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.event_seen (user_id, event_id, seen_at)
  select (select auth.uid()), e.id, least(coalesce(p_at, now()), now())
  from public.events e
  join public.group_members m on m.group_id = e.group_id and m.user_id = (select auth.uid())
  where e.id = p_event_id
  on conflict (user_id, event_id)
  do update set seen_at = greatest(public.event_seen.seen_at, excluded.seen_at);
$$;

create function public.mark_group_seen(p_group_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.group_seen (user_id, group_id, seen_at)
  select (select auth.uid()), m.group_id, now()
  from public.group_members m
  where m.group_id = p_group_id and m.user_id = (select auth.uid())
  on conflict (user_id, group_id)
  do update set seen_at = greatest(public.group_seen.seen_at, excluded.seen_at);
$$;

revoke execute on function public.mark_event_seen(uuid, timestamptz) from public, anon;
revoke execute on function public.mark_group_seen(uuid) from public, anon;
grant execute on function public.mark_event_seen(uuid, timestamptz) to authenticated;
grant execute on function public.mark_group_seen(uuid) to authenticated;

-- 처음 바꿀 때는 지금까지의 약속·그룹을 모두 본 것으로 시작한다.
-- (기기에만 있던 예전 기록은 옮길 수 없어서, 이렇게 안 하면 지난 댓글이 전부 안 읽음으로 뜬다)
insert into public.event_seen (user_id, event_id, seen_at)
select m.user_id, e.id, now()
from public.events e
join public.group_members m on m.group_id = e.group_id
on conflict do nothing;

insert into public.group_seen (user_id, group_id, seen_at)
select m.user_id, m.group_id, now()
from public.group_members m
on conflict do nothing;
