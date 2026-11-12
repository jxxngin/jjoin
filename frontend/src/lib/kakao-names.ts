import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type KakaoNames = {
  // 나 자신의 카톡 이름 (마이페이지)
  self: string | null;
  // 이 그룹에서 이 사람의 카톡 이름. 내가 그 그룹의 방장일 때만 있다.
  inGroup: (groupId: string, userId: string) => string | null;
};

// 내가 볼 수 있는 카톡 이름. 카톡 이름은 그 그룹의 방장에게, 그 그룹 안에서만 보인다. (0029·0030)
// 방장이 모르는 사람이 들어왔는지 알아보고 내보낼 수 있게 하려는 것이라, 일반 멤버는 닉네임만 본다.
// 한 요청 안에서는 한 번만 불러온다.
export const getVisibleKakaoNames = cache(async (): Promise<KakaoNames> => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("visible_kakao_names");
  const rows = (data ?? []) as { group_id: string | null; user_id: string; kakao_name: string }[];
  const byGroup = new Map(rows.filter((row) => row.group_id).map((row) => [`${row.group_id}:${row.user_id}`, row.kakao_name]));
  return {
    self: rows.find((row) => row.group_id === null)?.kakao_name ?? null,
    inGroup: (groupId, userId) => byGroup.get(`${groupId}:${userId}`) ?? null,
  };
});
