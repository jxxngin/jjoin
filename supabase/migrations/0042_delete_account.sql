-- 탈퇴를 한 트랜잭션으로 한다. (#27 리뷰 P1)
-- 예전에는 Next가 prepare_account_deletion(그룹 넘기기·참여 비우기)을 먼저 커밋하고, 사진을 지운 뒤, 따로 계정을 지웠다.
-- 사진 정리나 계정 삭제가 실패하면 계정은 그대로인데 그룹·방장·참여 기록만 바뀐 채 남았다.
--
-- 이제 delete_account가 준비와 계정 삭제(auth.users → 프로필·참여·댓글·투표·알림이 연쇄로 지워짐)를 함께 한다.
-- 중간에 실패하면 모두 되돌아가서 아무것도 바뀌지 않는다.
-- 부르는 쪽(Next me/delete-actions.ts)은 사진을 먼저 지우고, 서버 비밀 키로 이 함수를 부른다.

------------------------------------------------------------
-- 1. 준비 본문을 사용자 id를 받는 함수로 옮긴다 (0037의 본문 그대로)
------------------------------------------------------------
create function public.prepare_account_deletion_of(uid uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  g record;
  heir uuid;
  ev record;
begin
  if uid is null then
    raise exception 'no user';
  end if;

  for g in select id from public.groups where owner_id = uid for update loop
    select user_id into heir
    from public.group_members
    where group_id = g.id and user_id <> uid
    order by joined_at
    limit 1;

    if heir is null then
      delete from public.groups where id = g.id;
    else
      update public.groups set owner_id = heir where id = g.id;
      update public.group_members set role = 'member' where group_id = g.id and user_id = uid;
      update public.group_members set role = 'owner' where group_id = g.id and user_id = heir;
    end if;
  end loop;

  update public.events e
  set created_by = gr.owner_id
  from public.groups gr
  where e.group_id = gr.id and e.created_by = uid;

  update public.date_polls p
  set created_by = gr.owner_id
  from public.groups gr
  where p.group_id = gr.id and p.created_by = uid;

  -- 참여 중인 약속은 set_participation처럼 약속 행을 잠근 뒤 빠지고 대기자를 올린다.
  for ev in
    select e.id
    from public.events e
    join public.event_participants p on p.event_id = e.id
    where p.user_id = uid and p.status = 'going'
    order by e.id
    for update of e
  loop
    delete from public.event_participants where event_id = ev.id and user_id = uid;
    perform public.promote_waitlist(ev.id);
  end loop;
end;
$$;

revoke execute on function public.prepare_account_deletion_of(uuid) from public, anon, authenticated;

------------------------------------------------------------
-- 2. 예전 함수는 위 함수를 부르게만 두고, 앱에서는 더 부르지 못하게 한다
--    (준비만 하고 계정은 남는 반쪽 탈퇴 경로를 닫는다)
------------------------------------------------------------
create or replace function public.prepare_account_deletion()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  perform public.prepare_account_deletion_of(auth.uid());
end;
$$;

revoke execute on function public.prepare_account_deletion() from public, anon, authenticated;

------------------------------------------------------------
-- 3. 탈퇴: 준비 + 계정 삭제를 한 번에
------------------------------------------------------------
create function public.delete_account(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.prepare_account_deletion_of(p_user);
  delete from auth.users where id = p_user;
end;
$$;

-- 서버(비밀 키)만 부른다. 부르는 쪽이 로그인한 본인인지와 '탈퇴' 입력을 확인한다.
revoke execute on function public.delete_account(uuid) from public, anon, authenticated;
grant execute on function public.delete_account(uuid) to service_role;
