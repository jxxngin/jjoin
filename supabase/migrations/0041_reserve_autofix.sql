-- 자동 수정 하루 한도 확인과 실행 기록을 한 번에 한다. (#27 리뷰)
-- 예전에는 Next가 최근 24시간 실행 수를 읽고(1), 별도 요청으로 실행 시각을 기록해서(2),
-- 오류 신고 두 건이 동시에 들어오면 둘 다 한도 안으로 보고 3건을 넘겨 실행할 수 있었다.
--
-- 자동 수정 전용 잠금(트랜잭션 동안)을 잡고, 한도를 넘지 않았으면 이 문의를 '실행 대기'로 기록하고 true,
-- 넘었으면 'capped'로 두고 false를 돌려준다. 관리자가 직접 다시 실행할 때(p_force)는 한도를 보지 않는다.
-- 부르는 쪽(Next lib/autofix.ts)은 true일 때만 GitHub 작업을 깨운다.
create function public.reserve_autofix(p_inquiry uuid, p_limit int, p_force boolean default false)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  recent int;
begin
  -- 같은 순간에 들어온 예약을 하나씩 처리한다. (트랜잭션이 끝나면 저절로 풀린다)
  perform pg_advisory_xact_lock(hashtext('jjoin.reserve_autofix'));

  if not p_force then
    select count(*) into recent from public.inquiries where auto_fix_at > now() - interval '24 hours';
    if recent >= p_limit then
      update public.inquiries set auto_fix_status = 'capped' where id = p_inquiry;
      return false;
    end if;
  end if;

  update public.inquiries
  set auto_fix_status = 'pending', auto_fix_url = null, auto_fix_at = now()
  where id = p_inquiry;
  return found;
end;
$$;

-- 서버(비밀 키)만 부른다.
revoke execute on function public.reserve_autofix(uuid, int, boolean) from public, anon, authenticated;
grant execute on function public.reserve_autofix(uuid, int, boolean) to service_role;
