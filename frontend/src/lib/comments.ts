import "server-only";
import type { AvatarColor } from "@/lib/avatar-style";
import { getVisibleKakaoNames } from "@/lib/kakao-names";
import { createClient } from "@/lib/supabase/server";

export type Comment = {
  id: string;
  body: string;
  // 댓글에서 @로 부른 멤버 id
  mentions: string[];
  createdAt: string;
  // 답글이면 원 댓글 id (한 단계만), 고쳤으면 고친 시각
  parentId: string | null;
  editedAt: string | null;
  // 하트를 누른 사람 id (누른 순서)
  likes: string[];
  author: {
    id: string;
    nickname: string;
    kakaoName: string | null;
    avatarUrl: string | null;
    avatarColor: AvatarColor;
  } | null;
};

type CommentRow = {
  id: string;
  body: string;
  mentions: string[];
  created_at: string;
  parent_id: string | null;
  edited_at: string | null;
  comment_likes: { user_id: string }[];
  profiles: {
    id: string;
    nickname: string;
    avatar_url: string | null;
    avatar_color: AvatarColor;
  } | null;
};

// 댓글이 달린 곳. 약속 댓글과 투표 댓글은 표(comments) 하나에 있고 기능도 같다. (0036)
export type CommentTarget = { kind: "event" | "poll"; id: string };

// 약속·투표 댓글. 오래된 순. 그룹 멤버가 아니면 RLS 때문에 빈 목록이다.
// seenUpTo: 화면을 열었을 때 '여기까지 봤다'고 남길 시각. 댓글을 조회하기 직전 시각과 실제로 받은 댓글의 마지막 시각 중 늦은 쪽.
// (조회 뒤에 온 댓글은 화면에 없으니 아직 안 본 것이고, 조회에 섞여 들어온 댓글은 화면에 보였으니 본 것이다)
export async function getComments(target: CommentTarget): Promise<{ comments: Comment[]; seenUpTo: string }> {
  const supabase = await createClient();
  const requestedAt = new Date().toISOString();
  const column = target.kind === "event" ? "event_id" : "poll_id";
  const [kakaoNames, { data: parent }] = await Promise.all([
    getVisibleKakaoNames(),
    supabase.from(target.kind === "event" ? "events" : "date_polls").select("group_id").eq("id", target.id).maybeSingle(),
  ]);
  const groupId = parent?.group_id as string | undefined;
  const { data, error } = await supabase
    .from("comments")
    .select("id, body, mentions, created_at, parent_id, edited_at, comment_likes(user_id), profiles(id, nickname, avatar_url, avatar_color)")
    .eq(column, target.id)
    .order("created_at")
    .order("created_at", { referencedTable: "comment_likes" })
    .overrideTypes<CommentRow[], { merge: false }>();

  if (error) throw new Error(`댓글을 불러오지 못했어요. (${error.message})`);

  const lastShown = data.reduce((latest, row) => (Date.parse(row.created_at) > Date.parse(latest) ? row.created_at : latest), requestedAt);
  const comments = data.map((row) => ({
    id: row.id,
    body: row.body,
    mentions: row.mentions,
    createdAt: row.created_at,
    parentId: row.parent_id,
    editedAt: row.edited_at,
    likes: row.comment_likes.map((like) => like.user_id),
    author: row.profiles
      ? {
          id: row.profiles.id,
          nickname: row.profiles.nickname,
          kakaoName: groupId ? kakaoNames.inGroup(groupId, row.profiles.id) : null,
          avatarUrl: row.profiles.avatar_url,
          avatarColor: row.profiles.avatar_color,
        }
      : null,
  }));
  // DB 시각은 마이크로초까지라 밀리초로 바꾸면 뒷자리가 잘린다. 1ms를 더해 마지막으로 보여 준 댓글이 반드시 포함되게 한다.
  return { comments, seenUpTo: new Date(Date.parse(lastShown) + 1).toISOString() };
}
