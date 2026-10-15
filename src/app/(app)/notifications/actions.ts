"use server";

import { getUserId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// 알림 기록 화면을 열면 모두 읽음으로 바꾼다.
// 댓글·언급 알림은 목록에서 내용을 읽었으니, 그 약속도 그 댓글 시각까지 본 것으로 서버에 남긴다.
// (약속 카드의 안 읽은 댓글 숫자가 다른 기기에서도 꺼진다)
export async function markAllNotificationsRead() {
  const userId = await getUserId();
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("read_at", null)
    .select("event_id, kind, created_at");

  const latestByEvent = new Map<string, string>();
  for (const row of data ?? []) {
    if (!row.event_id || (row.kind !== "comment" && row.kind !== "mention")) continue;
    const previous = latestByEvent.get(row.event_id);
    if (!previous || Date.parse(row.created_at) > Date.parse(previous)) latestByEvent.set(row.event_id, row.created_at);
  }
  await Promise.all(
    [...latestByEvent].map(([eventId, at]) =>
      supabase.rpc("mark_event_seen", { p_event_id: eventId, p_at: at }),
    ),
  );
}
