-- 자동 수정 예약이 이번 시도의 식별자(예약 시각)를 돌려준다. (#37 리뷰)
-- GitHub 작업을 깨우지 못해 'failed'로 기록할 때, 같은 문의를 그 사이 다시 예약한 새 시도까지 실패로 덮지 않도록
-- 부르는 쪽(Next lib/autofix.ts)이 "auto_fix_at이 내 예약 시각이고 아직 pending일 때만" 실패로 바꾼다.
--
-- 반환형을 바꾸려면 함수를 지워야 해서, 시각을 돌려주는 함수를 새로 만들고 예전 함수는 이것을 부르게 둔다.

create function public.reserve_autofix_at(p_inquiry uuid, p_limit int, p_force boolean default false)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  recent int;
  reserved timestamptz;
begin
  -- 같은 순간에 들어온 예약을 하나씩 처리한다. (트랜잭션이 끝나면 저절로 풀린다)
  perform pg_advisory_xact_lock(hashtext('jjoin.reserve_autofix'));

  if not p_force then
    select count(*) into recent from public.inquiries where auto_fix_at > now() - interval '24 hours';
    if recent >= p_limit then
      update public.inquiries set auto_fix_status = 'capped' where id = p_inquiry;
      return null;
    end if;
  end if;

  update public.inquiries
  set auto_fix_status = 'pending', auto_fix_url = null, auto_fix_at = now()
  where id = p_inquiry
  returning auto_fix_at into reserved;
  return reserved;
end;
$$;

revoke execute on function public.reserve_autofix_at(uuid, int, boolean) from public, anon, authenticated;
grant execute on function public.reserve_autofix_at(uuid, int, boolean) to service_role;

-- 예전 함수(true/false)는 새 함수를 부른다. (배포 중 예전 코드와 테스트가 그대로 쓰게)
create or replace function public.reserve_autofix(p_inquiry uuid, p_limit int, p_force boolean default false)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  return public.reserve_autofix_at(p_inquiry, p_limit, p_force) is not null;
end;
$$;
