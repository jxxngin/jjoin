-- 그룹 프로필: 대표 이모지, 색깔, 한 줄 소개. 방장만 바꿀 수 있다. (groups의 update 정책)
alter table public.groups
  add column emoji text not null default '👥' check (char_length(emoji) between 1 and 16),
  add column color text not null default 'orange'
    check (color in ('orange', 'rose', 'amber', 'emerald', 'sky', 'violet', 'stone')),
  add column description text check (char_length(description) <= 60);

grant update (name, emoji, color, description) on public.groups to authenticated;

-- 그룹을 만들 때 프로필도 함께 정한다.
drop function public.create_group(text);

create function public.create_group(group_name text, group_emoji text, group_color text)
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

  insert into public.groups (name, emoji, color, owner_id)
  values (trim(group_name), group_emoji, group_color, uid)
  returning id into new_id;

  insert into public.group_members (group_id, user_id, role)
  values (new_id, uid, 'owner');

  return new_id;
end;
$$;

revoke execute on function public.create_group(text, text, text) from public, anon;
grant execute on function public.create_group(text, text, text) to authenticated;

-- 초대 화면에서도 그룹 프로필을 보여 준다. 반환 컬럼이 바뀌므로 다시 만든다.
drop function public.get_invite(text);

create function public.get_invite(code text)
returns table (
  group_id uuid,
  group_name text,
  group_emoji text,
  group_color text,
  group_description text,
  member_count bigint,
  is_member boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    g.id,
    g.name,
    g.emoji,
    g.color,
    g.description,
    (select count(*) from public.group_members m where m.group_id = g.id),
    exists (
      select 1 from public.group_members m
      where m.group_id = g.id and m.user_id = (select auth.uid())
    )
  from public.groups g
  where g.invite_code = code;
$$;

revoke execute on function public.get_invite(text) from public, anon;
grant execute on function public.get_invite(text) to authenticated;
