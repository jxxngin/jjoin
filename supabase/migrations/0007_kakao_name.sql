-- 닉네임을 바꿔도 누구인지 알 수 있게 카카오 이름을 따로 보관한다.
-- 본인도 수정할 수 없다. (profiles의 update 권한은 nickname, avatar_url뿐)
create function public.kakao_name_from(meta jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    nullif(meta ->> 'name', ''),
    nullif(meta ->> 'full_name', ''),
    nullif(meta ->> 'user_name', ''),
    nullif(meta ->> 'preferred_username', '')
  );
$$;

alter table public.profiles add column kakao_name text;

update public.profiles p
set kakao_name = public.kakao_name_from(u.raw_user_meta_data)
from auth.users u
where u.id = p.id;

-- 가입 시 닉네임과 카카오 이름을 함께 채운다.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  kname text := public.kakao_name_from(new.raw_user_meta_data);
begin
  insert into public.profiles (id, nickname, kakao_name, avatar_url)
  values (
    new.id,
    coalesce(kname, '친구'),
    kname,
    coalesce(
      new.raw_user_meta_data ->> 'avatar_url',
      new.raw_user_meta_data ->> 'picture'
    )
  );
  return new;
end;
$$;

-- 카카오에서 이름을 바꾸고 다시 로그인하면 카카오 이름만 따라 바꾼다. 닉네임은 그대로 둔다.
create function public.sync_kakao_name()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set kakao_name = public.kakao_name_from(new.raw_user_meta_data)
  where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_updated
  after update of raw_user_meta_data on auth.users
  for each row execute function public.sync_kakao_name();

revoke execute on function public.sync_kakao_name() from public, anon, authenticated;
