-- 그룹과 멤버. 생성·참여는 RPC로만 하고, 직접 insert는 막는다.
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 30),
  invite_code text not null unique
    default substr(replace(gen_random_uuid()::text, '-', ''), 1, 10),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index group_members_user_id_idx on public.group_members (user_id);

-- RLS 정책 안에서 group_members를 다시 조회하면 무한 재귀가 나므로
-- 정책을 우회하는 security definer 함수로 멤버 여부를 확인한다.
create function public.is_group_member(gid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.group_members
    where group_id = gid and user_id = (select auth.uid())
  );
$$;

create function public.shares_group_with(other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.group_members mine
    join public.group_members theirs on theirs.group_id = mine.group_id
    where mine.user_id = (select auth.uid()) and theirs.user_id = other
  );
$$;

alter table public.groups enable row level security;
alter table public.group_members enable row level security;

create policy "멤버만 그룹 조회"
  on public.groups for select
  to authenticated
  using (public.is_group_member(id));

create policy "방장만 그룹 수정"
  on public.groups for update
  to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "방장만 그룹 삭제"
  on public.groups for delete
  to authenticated
  using ((select auth.uid()) = owner_id);

create policy "같은 그룹 멤버끼리 조회"
  on public.group_members for select
  to authenticated
  using (public.is_group_member(group_id));

create policy "방장이 아니면 스스로 나가기"
  on public.group_members for delete
  to authenticated
  using ((select auth.uid()) = user_id and role = 'member');

-- 프로필은 이제 본인과 같은 그룹 멤버만 볼 수 있다.
drop policy "로그인 사용자는 프로필 조회" on public.profiles;

create policy "본인과 같은 그룹 멤버의 프로필 조회"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id or public.shares_group_with(id));

-- 그룹을 만들고 만든 사람을 방장으로 넣는다.
create function public.create_group(group_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  new_id uuid;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  insert into public.groups (name, owner_id)
  values (trim(group_name), uid)
  returning id into new_id;

  insert into public.group_members (group_id, user_id, role)
  values (new_id, uid, 'owner');

  return new_id;
end;
$$;

-- 초대 화면에서 참여 전에 그룹 이름을 보여 주기 위한 조회. 코드를 아는 사람만 볼 수 있다.
create function public.get_invite(code text)
returns table (group_id uuid, group_name text, member_count bigint, is_member boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select
    g.id,
    g.name,
    (select count(*) from public.group_members m where m.group_id = g.id),
    exists (
      select 1 from public.group_members m
      where m.group_id = g.id and m.user_id = (select auth.uid())
    )
  from public.groups g
  where g.invite_code = code;
$$;

-- 초대 코드로 그룹에 참여한다. 이미 멤버면 그대로 둔다.
create function public.join_group(code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  gid uuid;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  select id into gid from public.groups where invite_code = code;
  if gid is null then
    raise exception 'invalid invite code';
  end if;

  insert into public.group_members (group_id, user_id)
  values (gid, uid)
  on conflict do nothing;

  return gid;
end;
$$;

-- 새 테이블·함수에는 기본 권한이 없으므로 직접 준다.
grant select, delete on public.group_members to authenticated;
grant select, delete, update (name) on public.groups to authenticated;

revoke execute on function public.is_group_member(uuid) from public, anon;
revoke execute on function public.shares_group_with(uuid) from public, anon;
revoke execute on function public.create_group(text) from public, anon;
revoke execute on function public.get_invite(text) from public, anon;
revoke execute on function public.join_group(text) from public, anon;

grant execute on function public.is_group_member(uuid) to authenticated;
grant execute on function public.shares_group_with(uuid) to authenticated;
grant execute on function public.create_group(text) to authenticated;
grant execute on function public.get_invite(text) to authenticated;
grant execute on function public.join_group(text) to authenticated;
