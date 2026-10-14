-- 프로필 사진 저장소. 누구나 볼 수 있고, 올리고 바꾸는 건 본인 폴더({user id}/)만 가능하다.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "본인 폴더에 프로필 사진 업로드"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "본인 프로필 사진 조회"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "본인 프로필 사진 교체"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "본인 프로필 사진 삭제"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- 닉네임 길이 제한. 기존 카카오 닉네임은 검사하지 않는다.
alter table public.profiles
  add constraint profiles_nickname_length
  check (char_length(nickname) between 1 and 20) not valid;
