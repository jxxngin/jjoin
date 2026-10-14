-- 사진이 없을 때 보여 줄 기본 프로필(파스텔 유령) 색. 가입할 때 무작위로 정해지고 본인이 바꿀 수 있다.
-- 이미지: public/avatars/ghost-{색}.png
alter table public.profiles
  add column avatar_color text not null
    default (array['lavender', 'sky', 'mint', 'pink', 'peach', 'butter'])[floor(random() * 6)::int + 1]
    check (avatar_color in ('lavender', 'sky', 'mint', 'pink', 'peach', 'butter'));

grant update (avatar_color) on public.profiles to authenticated;
