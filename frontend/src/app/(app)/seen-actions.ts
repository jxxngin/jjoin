"use server";

import { refresh } from "next/cache";
import { getUserId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 약속 화면을 열면 부른다.
// - 이 약속을 지금 본 것으로 서버에 남긴다. (약속 카드의 안 읽은 댓글 숫자, 그룹 새 소식. 모든 기기 공통)
// - 이 약속에 대한 알림(새 약속·댓글·언급·리마인더)도 읽음으로 바꾸고, 바뀐 게 있으면 종의 점을 다시 그린다.
export async function markEventSeen(eventId: string) {
  if (!UUID.test(eventId)) return;
  const userId = await getUserId();
  const supabase = await createClient();
  const [, { data }] = await Promise.all([
    supabase.rpc("mark_event_seen", { p_event_id: eventId }),
    supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("event_id", eventId)
      .is("read_at", null)
      .select("id"),
  ]);
  if (data && data.length > 0) refresh();
}

// 그룹 화면을 열면 부른다. 홈 그룹 동그라미의 새 소식 테두리를 모든 기기에서 끈다.
export async function markGroupSeen(groupId: string) {
  if (!UUID.test(groupId)) return;
  const supabase = await createClient();
  await supabase.rpc("mark_group_seen", { p_group_id: groupId });
}
