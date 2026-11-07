-- 고친 문의를 '배포됨'으로 처리하는 일을 한 트랜잭션으로 한다. (#27·#29 리뷰)
-- Next의 /api/autofix/deployed가 부른다. (Spring AutofixService.deployed는 같은 일을 자체 트랜잭션으로 한다)
-- 예전에는 Next가 안내 글 INSERT(→ 트리거가 앱 알림 inquiry_reply 생성)와 문의 UPDATE를 따로 보내서,
-- 중간에 실패하면 알림만 남거나 다시 처리할 때 알림이 겹칠 수 있었다.
--
-- 받은 문의 id와 그 문의로 묶인 중복 문의 중 아직 배포 처리되지 않은 것을 잠그고,
-- 처리 완료·배포 시각을 기록하고, 대화에 안내 글을 남긴다(트리거가 문의한 사람의 알림 목록에도 남긴다).
-- 처리한 문의(id, 제목, 문의한 사람)를 돌려줘서 부르는 쪽이 푸시를 보낸다. 이미 처리된 문의는 다시 하지 않는다.
create function public.mark_inquiries_deployed(p_ids uuid[], p_notice text)
returns table (id uuid, title text, user_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  return query
  with targets as (
    select i.id
    from public.inquiries i
    where (i.id = any (p_ids) or i.duplicate_of = any (p_ids))
      and i.deployed_at is null
    for update
  ), done as (
    update public.inquiries i
    set status = 'done', deployed_at = now()
    from targets t
    where i.id = t.id
    returning i.id, i.title, i.user_id
  ), notice as (
    insert into public.inquiry_messages (inquiry_id, user_id, is_admin, body)
    select d.id, null, true, p_notice from done d
  )
  select d.id, d.title, d.user_id from done d;
end;
$$;

-- 서버(비밀 키)만 부른다.
revoke execute on function public.mark_inquiries_deployed(uuid[], text) from public, anon, authenticated;
grant execute on function public.mark_inquiries_deployed(uuid[], text) to service_role;
