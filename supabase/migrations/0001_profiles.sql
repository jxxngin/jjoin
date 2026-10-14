-- 프로필: auth.users 1:1. 카카오 로그인으로 가입하면 트리거가 자동 생성한다.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nickname text not null,
  avatar_url text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- 그룹 기능이 생기면 "같은 그룹 멤버만"으로 좁힌다.
create policy "로그인 사용자는 프로필 조회"
  on public.profiles for select
  to authenticated
  using (true);

create policy "본인 프로필만 수정"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- 카카오 메타데이터 키는 Supabase가 name/full_name/user_name, avatar_url/picture 등으로 채운다.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, nickname, avatar_url)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'name', ''),
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'user_name', ''),
      nullif(new.raw_user_meta_data ->> 'preferred_username', ''),
      '친구'
    ),
    coalesce(
      new.raw_user_meta_data ->> 'avatar_url',
      new.raw_user_meta_data ->> 'picture'
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 트리거보다 먼저 가입한 사용자가 있으면 채워 넣는다.
insert into public.profiles (id, nickname, avatar_url)
select
  id,
  coalesce(nullif(raw_user_meta_data ->> 'name', ''), '친구'),
  coalesce(raw_user_meta_data ->> 'avatar_url', raw_user_meta_data ->> 'picture')
from auth.users
on conflict (id) do nothing;
