import { getUserId } from "@/lib/auth";
import { getComments, type Comment } from "@/lib/comments";
import { formatEventDate } from "@/lib/datetime";
import { getGroup } from "@/lib/groups";
import { deleteComment, editComment, postComment } from "../comment-actions";
import { CommentForm, type Mentionable } from "./comment-form";
import { CommentRow, type CommentView } from "./comment-row";

type Post = (parentId: string | null, body: string, mentionIds: string[]) => Promise<{ error?: string }>;

// 댓글 목록 + 입력칸. 약속 댓글과 날짜 투표 댓글이 같이 쓴다.
// 원 댓글 아래에 답글을 한 단계로 모아 보여 준다. 본인 댓글은 고치고 지울 수 있다.
// withLikes: 하트를 보여 줄지 (약속 댓글만), mentionables: @로 부를 수 있는 사람
export function CommentSection({
  comments,
  userId,
  nicknameById,
  post,
  edit,
  remove,
  withLikes,
  mentionables,
}: {
  comments: Comment[];
  userId: string;
  nicknameById: Map<string, string>;
  post: Post;
  edit: (commentId: string, text: string) => Promise<{ error?: string }>;
  remove: (commentId: string) => Promise<void>;
  withLikes: boolean;
  mentionables: Mentionable[];
}) {
  const view = (comment: Comment): CommentView => ({
    id: comment.id,
    body: comment.body,
    mentions: comment.mentions.map((id) => ({ id, name: nicknameById.get(id) ?? null })),
    timeLabel: formatEventDate(comment.createdAt),
    edited: comment.editedAt !== null,
    author: comment.author
      ? {
          id: comment.author.id,
          nickname: comment.author.nickname,
          kakaoName: comment.author.kakaoName,
          avatarUrl: comment.author.avatarUrl,
          avatarColor: comment.author.avatarColor,
        }
      : null,
    likes: withLikes
      ? {
          count: comment.likes.length,
          mine: comment.likes.includes(userId),
          names: comment.likes.map((id) => nicknameById.get(id) ?? "알 수 없음"),
        }
      : null,
  });

  const roots = comments.filter((c) => c.parentId === null);
  const repliesOf = (id: string) => comments.filter((c) => c.parentId === id);

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-semibold">댓글 {comments.length}</h2>

      {roots.length > 0 && (
        <ul className="flex flex-col gap-4">
          {roots.map((root) => (
            <li key={root.id} className="flex flex-col gap-3">
              <CommentRow
                comment={view(root)}
                isMine={root.author?.id === userId}
                isReply={false}
                edit={edit.bind(null, root.id)}
                remove={remove.bind(null, root.id)}
                reply={post.bind(null, root.id)}
                mentionables={mentionables}
              />
              {repliesOf(root.id).map((reply) => (
                <CommentRow
                  key={reply.id}
                  comment={view(reply)}
                  isMine={reply.author?.id === userId}
                  isReply
                  edit={edit.bind(null, reply.id)}
                  remove={remove.bind(null, reply.id)}
                  reply={null}
                  mentionables={mentionables}
                />
              ))}
            </li>
          ))}
        </ul>
      )}

      <CommentForm post={post.bind(null, null)} members={mentionables} />
    </section>
  );
}

// 그룹 멤버 중 나를 뺀 사람을 @ 목록으로
export function mentionablesFrom(members: Mentionable[], userId: string) {
  return members
    .filter((m) => m.id !== userId)
    .map(({ id, nickname, kakaoName, avatarUrl, avatarColor }) => ({ id, nickname, kakaoName, avatarUrl, avatarColor }));
}

// 약속 댓글. 오래된 순으로 보여 주고, 아래에서 새 댓글을 쓴다. @언급·하트·답글·수정이 된다.
export async function Comments({ eventId, groupId }: { eventId: string; groupId: string }) {
  const [comments, userId, group] = await Promise.all([getComments(eventId), getUserId(), getGroup(groupId)]);
  const members = group?.members ?? [];

  return (
    <CommentSection
      comments={comments}
      userId={userId}
      nicknameById={new Map(members.map((m) => [m.id, m.nickname]))}
      post={postComment.bind(null, eventId)}
      edit={editComment}
      remove={deleteComment}
      withLikes
      mentionables={mentionablesFrom(members, userId)}
    />
  );
}
