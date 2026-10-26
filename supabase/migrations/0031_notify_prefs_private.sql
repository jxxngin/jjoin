-- 알림 받기 설정(notify_*)은 본인만 읽는다.
-- 지금까지는 같은 그룹 멤버라면 서로의 알림 켜고 끄기 값을 DB에서 읽을 수 있었다. (화면에는 안 나왔지만)
-- 알림을 보내는 서버(비밀 키)는 그대로 읽는다. (0011의 service_role 권한)

-- 프로필 표는 닉네임·사진처럼 화면에 나오는 열만 읽게 한다. (카톡 이름은 0029에서 이미 뺐다)
revoke select on public.profiles from authenticated;
grant select (id, nickname, avatar_url, avatar_color, created_at) on public.profiles to authenticated;

-- 내 알림 받기 설정 (알림 화면의 ⚙️ 알림 설정)
create function public.my_notification_prefs()
returns table (
  notify_new_event boolean,
  notify_promoted boolean,
  notify_day_before boolean,
  notify_mention boolean,
  notify_hour_before boolean,
  notify_comment boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select notify_new_event, notify_promoted, notify_day_before, notify_mention, notify_hour_before, notify_comment
  from public.profiles
  where id = (select auth.uid());
$$;

revoke execute on function public.my_notification_prefs() from public, anon;
grant execute on function public.my_notification_prefs() to authenticated;
