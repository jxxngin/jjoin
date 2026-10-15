"use server";

import { refresh } from "next/cache";
import { getUserId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// 알림 기록 화면을 열면 모두 읽음으로 바꾼다.
export async function markAllNotificationsRead() {
  const userId = await getUserId();
  const supabase = await createClient();
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("read_at", null);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 약속 화면을 열면 그 약속에 대한 알림(새 약속·댓글·언급·리마인더)은 이미 본 것이므로 읽음으로 바꾼다.
// 바뀐 게 있으면 머리글 종의 "새 알림" 점도 다시 그린다.
export async function markEventNotificationsRead(eventId: string) {
  if (!UUID.test(eventId)) return;
  const userId = await getUserId();
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("event_id", eventId)
    .is("read_at", null)
    .select("id");
  if (data && data.length > 0) refresh();
}
