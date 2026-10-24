import { Avatar } from "@/components/avatar";
import { PersonName } from "@/components/person-name";
import { getUserId } from "@/lib/auth";
import { getComments, type Comment } from "@/lib/comments";
import { formatEventDate } from "@/lib/datetime";
import { getGroup } from "@/lib/groups";
import { deleteComment, postComment } from "../comment-actions";
import { CommentForm, DeleteCommentButton, type Mentionable } from "./comment-form";
import { CommentLikeButton } from "./comment-like-button";

// 언급은 댓글 맨 앞에 "@민수 @지원 "처럼 저장된다. (comment-form.tsx)
// 그 앞부분은 저장된 글자 대신 지금 닉네임으로 다시 그려서, 닉네임을 바꿔도 강조가 풀리지 않게 한다.
function CommentBody({ body, mentions }: { body: string; mentions: { id: string; name: string | null }[] }) {
  let rest = body;
  const shown: { id: string; name: string }[] = [];
  for (const mention of mentions) {
    const match = /^@([^s@]+) /.exec(rest);
    if (!match) break;
    rest = rest.slice(match[0].length);
    // 그룹을 나간 사람은 저장된 이름 그대로 보여 준다.
    shown.push({ id: mention.id, name: mention.name ?? match[1] });
  }
  return (
    <p className="text-sm whitespace-pre-wrap break-words text-stone-700 dark:text-stone-300">
      {shown.map((mention) => (
        <span key={mention.id} className="font-semibold text-brand-ink">
          @{mention.name}{" "}
        </span>
      ))}
      {rest}
    </p>
  );
}

// 댓글 목록 + 입력칸. 약속 댓글과 날짜 투표 댓글이 같이 쓴다.
// withLikes: 하트를 보여 줄지 (약속 댓글만), mentionables: @로 부를 수 있는 사람
export function CommentSection({
  comments,
  userId,
  nicknameById,
  post,
  remove,
  withLikes,
  mentionables,
}: {
  comments: Comment[];
  userId: string;
  nicknameById: Map<string, string>;
  post: (body: string, mentionIds: string[]) => Promise<{ error?: string }>;
  remove: (commentId: string) => Promise<void>;
  withLikes: boolean;
  mentionables: Mentionable[];
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-semibold">댓글 {comments.length}</h2>

      {comments.length > 0 && (
        <ul className="flex flex-col gap-3">
          {comments.map((comment) => (
            <li key={comment.id} className="flex gap-3">
              <Avatar
                src={comment.author?.avatarUrl ?? null}
                color={comment.author?.avatarColor}
                size="sm"
              />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="flex items-center gap-2 text-sm">
                  {comment.author ? (
                    <PersonName
                      nickname={comment.author.nickname}
                      kakaoName={comment.author.kakaoName}
                      className="font-medium"
                    />
                  ) : (
                    <span className="text-stone-500">알 수 없음</span>
                  )}
                  <span className="text-xs text-stone-400">{formatEventDate(comment.createdAt)}</span>
                  {comment.author?.id === userId && (
                    <span className="ml-auto">
                      <DeleteCommentButton remove={remove.bind(null, comment.id)} />
                    </span>
                  )}
                </div>
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <CommentBody
                      body={comment.body}
                      mentions={comment.mentions.map((id) => ({ id, name: nicknameById.get(id) ?? null }))}
                    />
                  </div>
                  {withLikes && (
                    <CommentLikeButton
                      // 다른 사람이 누른 하트가 새로 불러와지면 버튼을 새 값으로 다시 시작한다.
                      key={`${comment.likes.length}-${comment.likes.includes(userId)}`}
                      commentId={comment.id}
                      liked={comment.likes.includes(userId)}
                      count={comment.likes.length}
                      likers={comment.likes.map((id) => nicknameById.get(id) ?? "알 수 없음")}
                    />
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <CommentForm post={post} members={mentionables} />
    </section>
  );
}

// 약속 댓글. 오래된 순으로 보여 주고, 아래에서 새 댓글을 쓴다. @언급·하트가 된다.
export async function Comments({ eventId, groupId }: { eventId: string; groupId: string }) {
  const [comments, userId, group] = await Promise.all([
    getComments(eventId),
    getUserId(),
    getGroup(groupId),
  ]);
  const members = group?.members ?? [];

  return (
    <CommentSection
      comments={comments}
      userId={userId}
      nicknameById={new Map(members.map((m) => [m.id, m.nickname]))}
      post={postComment.bind(null, eventId)}
      remove={deleteComment}
      withLikes
      mentionables={members
        .filter((m) => m.id !== userId)
        .map(({ id, nickname, kakaoName, avatarUrl, avatarColor }) => ({ id, nickname, kakaoName, avatarUrl, avatarColor }))}
    />
  );
}
