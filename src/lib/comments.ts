import "server-only";
import type { AvatarColor } from "@/lib/avatar-style";
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
    kakao_name: string | null;
    avatar_url: string | null;
    avatar_color: AvatarColor;
  } | null;
};

// 약속 댓글. 오래된 순. 그룹 멤버가 아니면 RLS 때문에 빈 목록이다.
export async function getComments(eventId: string): Promise<Comment[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("event_comments")
    .select("id, body, mentions, created_at, parent_id, edited_at, comment_likes(user_id), profiles(id, nickname, kakao_name, avatar_url, avatar_color)")
    .eq("event_id", eventId)
    .order("created_at")
    .order("created_at", { referencedTable: "comment_likes" })
    .overrideTypes<CommentRow[], { merge: false }>();

  if (error) throw new Error(`댓글을 불러오지 못했어요. (${error.message})`);

  return data.map((row) => ({
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
          kakaoName: row.profiles.kakao_name,
          avatarUrl: row.profiles.avatar_url,
          avatarColor: row.profiles.avatar_color,
        }
      : null,
  }));
}

// 날짜 투표 댓글. 오래된 순. 하트는 없다. 그룹 멤버가 아니면 RLS 때문에 빈 목록이다.
export async function getPollComments(pollId: string): Promise<Comment[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("poll_comments")
    .select("id, body, mentions, created_at, parent_id, edited_at, profiles(id, nickname, kakao_name, avatar_url, avatar_color)")
    .eq("poll_id", pollId)
    .order("created_at")
    .overrideTypes<Omit<CommentRow, "comment_likes">[], { merge: false }>();

  if (error) throw new Error(`댓글을 불러오지 못했어요. (${error.message})`);

  return data.map((row) => ({
    id: row.id,
    body: row.body,
    mentions: row.mentions,
    createdAt: row.created_at,
    parentId: row.parent_id,
    editedAt: row.edited_at,
    likes: [],
    author: row.profiles
      ? {
          id: row.profiles.id,
          nickname: row.profiles.nickname,
          kakaoName: row.profiles.kakao_name,
          avatarUrl: row.profiles.avatar_url,
          avatarColor: row.profiles.avatar_color,
        }
      : null,
  }));
}
