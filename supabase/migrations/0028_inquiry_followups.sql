-- 문의 기능 후속 작업 (PLAN.md §9)
-- 1. 우선순위(긴급·보통)와 '보류' 상태, 처리 완료 시각
-- 2. 중복 문의 묶기 (duplicate_of)
-- 3. 자동 수정 하루 한도 (auto_fix_at, 'capped')
-- 4. 스크린샷 첨부 (비공개 저장소 inquiry-images, images)
-- 5. 답변을 주고받는 대화 (inquiry_messages)
-- 6. 답변을 앱 안 알림 목록에도 (notifications.inquiry_id, 'inquiry_reply')
-- 7. 화면 오류 자동 기록 (client_errors)
-- 8. 고친 문의가 운영에 배포되면 자동으로 처리 완료 (deployed_at, .github/workflows/inquiry-deployed.yml)

------------------------------------------------------------
-- 1~4. 문의 열 추가
------------------------------------------------------------
alter table public.inquiries
  drop constraint inquiries_status_check,
  add constraint inquiries_status_check check (status in ('received', 'in_progress', 'on_hold', 'done')),
  add column priority text not null default 'normal' check (priority in ('urgent', 'normal')),
  -- 처리 완료로 바뀐 시각. 90일 뒤 기기 정보를 지우는 기준 (/api/cron/inquiry-digest)
  add column done_at timestamptz,
  -- 24시간 안에 들어온 같은 화면·비슷한 제목의 원래 문의
  add column duplicate_of uuid references public.inquiries (id) on delete set null,
  -- 자동 수정을 깨운 시각 (하루 한도 계산)
  add column auto_fix_at timestamptz,
  -- 첨부한 스크린샷의 저장소 경로 ({user id}/{파일})
  add column images text[] not null default '{}' check (cardinality(images) <= 3),
  -- 이 문의를 고친 커밋이 운영에 배포된 시각. 한 번만 자동으로 처리 완료한다.
  add column deployed_at timestamptz,
  drop constraint inquiries_auto_fix_status_check,
  add constraint inquiries_auto_fix_status_check
    check (auto_fix_status in ('pending', 'pr_opened', 'failed', 'skipped', 'capped'));

create index inquiries_duplicate_of_idx on public.inquiries (duplicate_of) where duplicate_of is not null;

grant insert (images) on public.inquiries to authenticated;
grant update (priority) on public.inquiries to authenticated;

-- 상태가 처리 완료로 바뀌면 그 시각을 남긴다. (기존 하루 5건 제한·답변 시각은 그대로)
create or replace function public.inquiries_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if (
      select count(*) from public.inquiries
      where user_id = new.user_id and created_at > now() - interval '1 day'
    ) >= 5 then
      raise exception 'too many inquiries';
    end if;
  else
    if new.reply is distinct from old.reply then
      new.replied_at := case when new.reply is null then null else now() end;
    end if;
    if new.status is distinct from old.status then
      new.done_at := case when new.status = 'done' then now() else null end;
    end if;
  end if;
  return new;
end;
$$;

update public.inquiries set done_at = coalesce(replied_at, created_at) where status = 'done';

------------------------------------------------------------
-- 4. 스크린샷 저장소. 비공개, 장당 3MB. 본인 폴더에 올리고, 본인과 관리자만 본다.
------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('inquiry-images', 'inquiry-images', false, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "본인 폴더에 문의 사진 업로드"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'inquiry-images' and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "본인·관리자만 문의 사진 조회"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'inquiry-images'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_app_admin())
  );

------------------------------------------------------------
-- 5. 문의 대화. 문의한 사람과 관리자가 주고받는다. 관리자 글인지는 서버가 정한다.
------------------------------------------------------------
create table public.inquiry_messages (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references public.inquiries (id) on delete cascade,
  user_id uuid default auth.uid() references public.profiles (id) on delete set null,
  is_admin boolean not null default false,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index inquiry_messages_inquiry_id_created_at_idx on public.inquiry_messages (inquiry_id, created_at);

alter table public.inquiry_messages enable row level security;

-- 이 문의를 볼 수 있는지 (문의한 사람이나 관리자)
create function public.can_view_inquiry(p_inquiry uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_app_admin() or exists (
    select 1 from public.inquiries where id = p_inquiry and user_id = (select auth.uid())
  );
$$;

revoke execute on function public.can_view_inquiry(uuid) from public, anon;
grant execute on function public.can_view_inquiry(uuid) to authenticated;

create policy "본인·관리자만 문의 대화 조회"
  on public.inquiry_messages for select to authenticated
  using (public.can_view_inquiry(inquiry_id));

create policy "본인·관리자만 문의 대화 작성"
  on public.inquiry_messages for insert to authenticated
  with check (public.can_view_inquiry(inquiry_id) and user_id = (select auth.uid()));

grant select on public.inquiry_messages to authenticated;
grant insert (inquiry_id, body) on public.inquiry_messages to authenticated;
grant select, insert on public.inquiry_messages to service_role;

-- 관리자 글 표시는 로그인한 사람이 관리자인지로 정한다. (서버 비밀 키로 쓰는 배포 안내 글은 그대로 관리자 글)
-- 그리고 하루에 20개까지만 쓴다. 관리자가 쓰면 문의한 사람의 알림 목록에 남긴다.
create function public.inquiry_messages_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
begin
  if (select auth.uid()) is not null then
    new.is_admin := public.is_app_admin();
  end if;
  if not new.is_admin and (
    select count(*) from public.inquiry_messages
    where user_id = new.user_id and created_at > now() - interval '1 day'
  ) >= 20 then
    raise exception 'too many messages';
  end if;
  if new.is_admin then
    select user_id into v_owner from public.inquiries where id = new.inquiry_id;
    if v_owner is not null and v_owner is distinct from new.user_id then
      insert into public.notifications (user_id, inquiry_id, kind) values (v_owner, new.inquiry_id, 'inquiry_reply');
    end if;
  end if;
  return new;
end;
$$;

create trigger inquiry_messages_guard
  before insert on public.inquiry_messages
  for each row execute function public.inquiry_messages_guard();

revoke execute on function public.inquiry_messages_guard() from public, anon, authenticated;

------------------------------------------------------------
-- 6. 알림 목록에 문의 답변. 약속 없는 알림을 허용한다.
------------------------------------------------------------
alter table public.notifications
  alter column event_id drop not null,
  add column inquiry_id uuid references public.inquiries (id) on delete cascade,
  drop constraint notifications_kind_check,
  add constraint notifications_kind_check
    check (kind in ('new_event', 'promoted', 'day_before', 'mention', 'hour_before', 'comment', 'inquiry_reply')),
  add constraint notifications_target_check check (event_id is not null or inquiry_id is not null);

-- 지금까지의 답변(한 번 답변)을 대화의 첫 관리자 글로 옮긴다. 알림은 새로 만들지 않는다.
alter table public.inquiry_messages disable trigger inquiry_messages_guard;
insert into public.inquiry_messages (inquiry_id, user_id, is_admin, body, created_at)
select id, null, true, reply, coalesce(replied_at, created_at) from public.inquiries where reply is not null;
alter table public.inquiry_messages enable trigger inquiry_messages_guard;

------------------------------------------------------------
-- 7. 화면 오류 자동 기록. 로그인한 사용자의 브라우저가 남기고, 관리자만 본다. 30일 뒤 지운다.
------------------------------------------------------------
create table public.client_errors (
  id bigint generated always as identity primary key,
  user_id uuid default auth.uid() references public.profiles (id) on delete set null,
  message text not null check (char_length(message) between 1 and 500),
  stack text check (char_length(stack) <= 4000),
  page_path text check (char_length(page_path) <= 300),
  user_agent text check (char_length(user_agent) <= 400),
  created_at timestamptz not null default now()
);

create index client_errors_created_at_idx on public.client_errors (created_at desc);

alter table public.client_errors enable row level security;

create policy "본인 이름으로 오류 기록"
  on public.client_errors for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "관리자만 오류 기록 조회"
  on public.client_errors for select to authenticated
  using (public.is_app_admin());

grant insert (message, stack, page_path, user_agent) on public.client_errors to authenticated;
grant select on public.client_errors to authenticated;
grant select, delete on public.client_errors to service_role;

-- 한 사람이 1시간에 30개까지만 남긴다. (넘으면 조용히 버린다)
create function public.client_errors_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (
    select count(*) from public.client_errors
    where user_id = new.user_id and created_at > now() - interval '1 hour'
  ) >= 30 then
    return null;
  end if;
  return new;
end;
$$;

create trigger client_errors_guard
  before insert on public.client_errors
  for each row execute function public.client_errors_guard();

revoke execute on function public.client_errors_guard() from public, anon, authenticated;
