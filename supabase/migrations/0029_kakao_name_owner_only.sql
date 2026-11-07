-- 카톡 이름은 방장에게만 보인다.
-- 방장이 모르는 사람이 들어왔는지 알아보고 필요하면 내보낼 수 있게, 자기가 방장인 그룹의 멤버 카톡 이름만 읽는다.
-- 일반 멤버는 닉네임만 본다. (화면에서만 숨기지 않고 DB에서 막는다)

-- 프로필 표에서 kakao_name 열만 빼고 읽게 한다.
revoke select on public.profiles from authenticated;
grant select (
  id, nickname, avatar_url, avatar_color, created_at,
  notify_new_event, notify_promoted, notify_day_before, notify_mention, notify_hour_before, notify_comment
) on public.profiles to authenticated;

-- 내가 볼 수 있는 카톡 이름: 나 자신 + 내가 방장인 그룹의 멤버
create function public.visible_kakao_names()
returns table (user_id uuid, kakao_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.kakao_name
  from public.profiles p
  where p.kakao_name is not null
    and (
      p.id = (select auth.uid())
      or exists (
        select 1
        from public.group_members member
        join public.group_members owner
          on owner.group_id = member.group_id
         and owner.user_id = (select auth.uid())
         and owner.role = 'owner'
        where member.user_id = p.id
      )
    );
$$;

revoke execute on function public.visible_kakao_names() from public, anon;
grant execute on function public.visible_kakao_names() to authenticated;
