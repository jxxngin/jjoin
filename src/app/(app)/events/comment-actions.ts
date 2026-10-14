"use server";

import { refresh } from "next/cache";
import { after } from "next/server";
import { flushNotifications } from "@/lib/push";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 댓글을 남긴다. mentionIds는 화면에서 @로 고른 멤버들이다.
// 그룹 멤버가 아닌 id는 DB 트리거가 알림에서 걸러 낸다.
export async function postComment(
  eventId: string,
  body: string,
  mentionIds: string[],
): Promise<{ error?: string }> {
  const text = body.trim();
  if (!text) return { error: "댓글을 입력해 주세요." };
  if (text.length > 500) return { error: "댓글은 500자까지 쓸 수 있어요." };

  const mentions = [...new Set(mentionIds.filter((id) => UUID.test(id)))].slice(0, 20);

  // 그룹 멤버가 아니면 RLS 때문에 실패한다.
  const supabase = await createClient();
  const { error } = await supabase
    .from("event_comments")
    .insert({ event_id: eventId, body: text, mentions });
  if (error) return { error: "댓글을 남기지 못했어요." };

  // 댓글·언급 알림(DB 트리거가 쌓음)은 응답을 보낸 뒤에 보낸다.
  after(async () => {
    try {
      await flushNotifications();
    } catch (e) {
      console.error("댓글 알림을 보내지 못했어요", e);
    }
  });

  refresh();
  return {};
}

export async function deleteComment(commentId: string) {
  // 본인 댓글이 아니면 RLS 때문에 지워지지 않는다.
  const supabase = await createClient();
  await supabase.from("event_comments").delete().eq("id", commentId);
  refresh();
}
