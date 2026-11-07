"use server";

import { refresh } from "next/cache";
import { getUserId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// 알림 기록 화면을 열면 화면에 보여 준 알림까지(upToId 이하) 읽음으로 바꾼다.
// 화면을 그린 뒤에 도착한 알림은 아직 보지 않았으니 그대로 둔다. (#27 리뷰)
// 댓글·언급 알림은 목록에서 내용을 읽었으니, 그 약속·투표도 그 댓글 시각까지 본 것으로 서버에 남긴다.
// (약속 카드의 안 읽은 댓글 숫자가 다른 기기에서도 꺼진다)
export async function markAllNotificationsRead(upToId: number) {
  if (!Number.isSafeInteger(upToId) || upToId < 1) return;
  const userId = await getUserId();
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("read_at", null)
    .lte("id", upToId)
    .select("event_id, poll_id, kind, created_at");

  // 약속·투표마다 가장 늦은 댓글 알림 시각. 키는 "event:<id>" / "poll:<id>"
  const latest = new Map<string, string>();
  for (const row of data ?? []) {
    if (row.kind !== "comment" && row.kind !== "mention") continue;
    const key = row.event_id ? `event:${row.event_id}` : row.poll_id ? `poll:${row.poll_id}` : null;
    if (!key) continue;
    const previous = latest.get(key);
    if (!previous || Date.parse(row.created_at) > Date.parse(previous)) latest.set(key, row.created_at);
  }
  await Promise.all(
    [...latest].map(([key, at]) => {
      const [kind, id] = key.split(":");
      return kind === "event"
        ? supabase.rpc("mark_event_seen", { p_event_id: id, p_at: at })
        : supabase.rpc("mark_poll_seen", { p_poll_id: id, p_at: at });
    }),
  );
}

// 알림 목록의 "모두 읽음" 버튼. 읽음으로 바꾸고 목록을 다시 그려 새 알림 표시를 끈다.
export async function readAllNotifications(upToId: number) {
  await markAllNotificationsRead(upToId);
  refresh();
}
