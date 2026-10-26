-- 카톡 이름은 "그 그룹의 방장"에게, 그 그룹 안에서만 보인다. (0029 보완)
-- 0029는 내가 방장인 그룹의 멤버라면 다른 그룹에서도 카톡 이름이 보였다.
-- 이제 그룹마다 따로 돌려주고, 화면은 지금 보는 그룹이 내가 방장인 그룹일 때만 카톡 이름을 붙인다.
-- group_id가 비어 있는 줄은 나 자신의 카톡 이름이다. (마이페이지)

drop function public.visible_kakao_names();

create function public.visible_kakao_names()
returns table (group_id uuid, user_id uuid, kakao_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select owner.group_id, p.id, p.kakao_name
  from public.group_members owner
  join public.group_members member on member.group_id = owner.group_id
  join public.profiles p on p.id = member.user_id
  where owner.user_id = (select auth.uid())
    and owner.role = 'owner'
    and p.kakao_name is not null
  union all
  select null, p.id, p.kakao_name
  from public.profiles p
  where p.id = (select auth.uid())
    and p.kakao_name is not null;
$$;

revoke execute on function public.visible_kakao_names() from public, anon;
grant execute on function public.visible_kakao_names() to authenticated;
