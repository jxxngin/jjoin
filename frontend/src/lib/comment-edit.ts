import "server-only";
import { refresh } from "next/cache";
import { splitMentions } from "@/lib/comment-text";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 댓글 내용 고치기. 앞의 언급(@이름)은 그대로 두고 그 뒤 내용만 바꾼다.
// 서버 액션(약속 댓글·투표 댓글)이 표 이름을 정해서 부른다. (브라우저에서 직접 부를 수 없게 액션 파일 밖에 둔다)
// 본인 댓글이 아니면 RLS 때문에 바뀌지 않는다.
export async function editCommentIn(
  table: "event_comments" | "poll_comments",
  commentId: string,
  text: string,
): Promise<{ error?: string }> {
  const content = text.trim();
  if (!UUID.test(commentId)) return { error: "댓글을 고치지 못했어요." };
  if (!content) return { error: "내용을 입력해 주세요." };

  const supabase = await createClient();
  const { data: current } = await supabase.from(table).select("body, mentions").eq("id", commentId).maybeSingle();
  if (!current) return { error: "댓글을 고치지 못했어요." };
  const { prefix } = splitMentions(current.body, current.mentions.length);
  const body = prefix + content;
  if (body.length > 500) return { error: "댓글은 500자까지 쓸 수 있어요." };

  const { data, error } = await supabase.from(table).update({ body }).eq("id", commentId).select("id");
  if (error || !data?.length) return { error: "댓글을 고치지 못했어요." };
  refresh();
  return {};
}

