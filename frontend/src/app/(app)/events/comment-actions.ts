"use server";

import { refresh } from "next/cache";
import { after } from "next/server";
import { splitMentions } from "@/lib/comment-text";
import type { CommentTarget } from "@/lib/comments";
import { flushNotifications } from "@/lib/push";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 약속 댓글과 투표 댓글이 같이 쓰는 서버 액션. 둘 다 comments 표 하나에 있다. (0036)

// 댓글을 남긴다. mentionIds는 화면에서 @로 고른 멤버들이다. parentId가 있으면 그 댓글의 답글이다.
// 그룹 멤버가 아니면 RLS 때문에 실패한다. 답글의 원 댓글은 DB 정책이, 언급·새 댓글 알림은 DB 트리거가 맡는다.
// 그사이 투표가 약속으로 확정됐으면 DB 트리거가 그 약속의 댓글로 저장한다. (다시 그리면 투표 화면이 약속 링크를 보여 준다)
export async function postComment(
  target: CommentTarget,
  parentId: string | null,
  body: string,
  mentionIds: string[],
): Promise<{ error?: string }> {
  const text = body.trim();
  if (!text) return { error: "댓글을 입력해 주세요." };
  if (text.length > 500) return { error: "댓글은 500자까지 쓸 수 있어요." };
  if ((target.kind !== "event" && target.kind !== "poll") || !UUID.test(target.id)) {
    return { error: "댓글을 남기지 못했어요." };
  }

  const mentions = [...new Set(mentionIds.filter((id) => UUID.test(id)))].slice(0, 20);

  const supabase = await createClient();
  const { error } = await supabase.from("comments").insert({
    event_id: target.kind === "event" ? target.id : null,
    poll_id: target.kind === "poll" ? target.id : null,
    body: text,
    mentions,
    parent_id: parentId && UUID.test(parentId) ? parentId : null,
  });
  if (error) return { error: "댓글을 남기지 못했어요." };

  // 댓글·언급 알림(DB 트리거가 쌓음)은 응답을 보낸 뒤에 보낸다. (알림 워커가 맡으면 아무것도 하지 않는다)
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

// 본인 댓글의 내용을 고친다. 앞의 언급(@이름)은 그대로 두고 그 뒤 내용만 바꾼다.
// 본인 댓글이 아니면 RLS 때문에 바뀌지 않는다.
export async function editComment(commentId: string, text: string): Promise<{ error?: string }> {
  const content = text.trim();
  if (!UUID.test(commentId)) return { error: "댓글을 고치지 못했어요." };
  if (!content) return { error: "내용을 입력해 주세요." };

  const supabase = await createClient();
  const { data: current } = await supabase.from("comments").select("body, mentions").eq("id", commentId).maybeSingle();
  if (!current) return { error: "댓글을 고치지 못했어요." };
  const { prefix } = splitMentions(current.body, current.mentions.length);
  const body = prefix + content;
  if (body.length > 500) return { error: "댓글은 500자까지 쓸 수 있어요." };

  const { data, error } = await supabase.from("comments").update({ body }).eq("id", commentId).select("id");
  if (error || !data?.length) return { error: "댓글을 고치지 못했어요." };
  refresh();
  return {};
}

export async function deleteComment(commentId: string) {
  // 본인 댓글이 아니면 RLS 때문에 지워지지 않는다.
  if (!UUID.test(commentId)) return;
  const supabase = await createClient();
  await supabase.from("comments").delete().eq("id", commentId);
  refresh();
}

// 댓글 하트를 누르거나 취소한다. 화면은 먼저 바뀌어 있으므로 다시 그리지 않는다.
// 그룹 멤버가 아니면 RLS 때문에 아무것도 바뀌지 않는다.
export async function toggleCommentLike(commentId: string, like: boolean): Promise<{ error?: string }> {
  if (!UUID.test(commentId)) return { error: "하트를 누르지 못했어요." };
  const supabase = await createClient();
  const { error } = like
    ? await supabase.from("comment_likes").insert({ comment_id: commentId })
    : await supabase.from("comment_likes").delete().eq("comment_id", commentId);
  // 이미 눌러 둔 하트를 또 누른 경우(23505)는 성공으로 친다.
  if (error && error.code !== "23505") return { error: "하트를 누르지 못했어요." };
  return {};
}
