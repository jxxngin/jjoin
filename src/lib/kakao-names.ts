import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

// 내가 볼 수 있는 카톡 이름 (사용자 id → 카톡 이름): 나 자신과 내가 방장인 그룹의 멤버만. (0029)
// 일반 멤버는 다른 사람의 카톡 이름을 DB에서 읽을 수 없고 닉네임만 본다.
// 한 요청 안에서는 한 번만 불러온다.
export const getVisibleKakaoNames = cache(async (): Promise<Map<string, string>> => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("visible_kakao_names");
  return new Map((data ?? []).map((row: { user_id: string; kakao_name: string }) => [row.user_id, row.kakao_name]));
});
