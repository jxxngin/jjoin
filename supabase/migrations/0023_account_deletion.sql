-- 회원 탈퇴 준비. 계정을 지우기 직전에 본인이 부른다. (지우기는 서버가 비밀 키로 auth 사용자를 지운다)
-- 계정을 지우면 profiles를 참조하는 데이터가 모두 같이 지워지는데, 그대로 두면 친구들 데이터까지 사라진다.
-- - 내가 방장인 그룹: 통째로 지워짐 → 가장 먼저 들어온 멤버에게 방장을 넘긴다 (혼자인 그룹만 지운다)
-- - 내가 만든 약속·날짜 투표: 친구들의 참여·댓글과 함께 지워짐 → 그 그룹의 방장에게 넘긴다
-- - 내가 '참여'로 있던 약속: 자리가 비어도 대기자가 올라오지 않음 → 먼저 빠지고 대기자를 올린다
create function public.prepare_account_deletion()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  g record;
  heir uuid;
  ev record;
begin
  if uid is null then
    raise exception 'not signed in';
  end if;

  for g in select id from public.groups where owner_id = uid loop
    select user_id into heir
    from public.group_members
    where group_id = g.id and user_id <> uid
    order by joined_at
    limit 1;

    if heir is null then
      delete from public.groups where id = g.id;
    else
      update public.groups set owner_id = heir where id = g.id;
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

  for ev in
    delete from public.event_participants
    where user_id = uid and status = 'going'
    returning event_id
  loop
    perform public.promote_waitlist(ev.event_id);
  end loop;
end;
$$;

revoke execute on function public.prepare_account_deletion() from public, anon;
grant execute on function public.prepare_account_deletion() to authenticated;
