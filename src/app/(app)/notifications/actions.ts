"use server";

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
