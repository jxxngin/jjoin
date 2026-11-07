"use server";

import { refresh } from "next/cache";
import { getUserId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 화면에 보여 준 댓글까지의 시각(lib/comments.ts의 seenUpTo). 올바른 시각이 아니면 null (그러면 아무것도 하지 않는다)
function seenTime(at: string) {
  const time = Date.parse(at);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

// 약속 화면의 댓글을 보여 주면 부른다. seenUpTo는 화면에 실제로 보여 준 댓글까지의 시각이다.
// - 이 약속을 그 시각까지 본 것으로 서버에 남긴다. (약속 카드의 안 읽은 댓글 숫자, 그룹 새 소식. 모든 기기 공통)
//   화면에 없던(그 뒤에 온) 댓글은 아직 안 본 것으로 둔다. (#27·#31 리뷰)
// - 그 시각까지 온 이 약속의 알림(새 약속·댓글·언급·리마인더)도 읽음으로 바꾸고, 바뀐 게 있으면 종의 점을 다시 그린다.
export async function markEventSeen(eventId: string, seenUpTo: string) {
  const at = seenTime(seenUpTo);
  if (!UUID.test(eventId) || !at) return;
  const userId = await getUserId();
  const supabase = await createClient();
  const [, { data }] = await Promise.all([
    supabase.rpc("mark_event_seen", { p_event_id: eventId, p_at: at }),
    supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("event_id", eventId)
      .is("read_at", null)
      .lte("created_at", at)
      .select("id"),
  ]);
  if (data && data.length > 0) refresh();
}

// 투표 화면의 댓글을 보여 주면 부른다. 보여 준 댓글까지의 시각(seenUpTo)까지 본 것으로 남겨 투표 카드의 안 읽은 댓글 숫자를 끄고,
// 그 시각까지 온 이 투표의 댓글·언급 알림을 읽음으로 바꾼다. (약속과 같다)
export async function markPollSeen(pollId: string, seenUpTo: string) {
  const at = seenTime(seenUpTo);
  if (!UUID.test(pollId) || !at) return;
  const userId = await getUserId();
  const supabase = await createClient();
  const [, { data }] = await Promise.all([
    supabase.rpc("mark_poll_seen", { p_poll_id: pollId, p_at: at }),
    supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("poll_id", pollId)
      .is("read_at", null)
      .lte("created_at", at)
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
