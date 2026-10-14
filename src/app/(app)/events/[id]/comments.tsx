import { Avatar } from "@/components/avatar";
import { PersonName } from "@/components/person-name";
import { getUserId } from "@/lib/auth";
import { getComments } from "@/lib/comments";
import { formatEventDate } from "@/lib/datetime";
import { getGroup } from "@/lib/groups";
import { CommentForm, DeleteCommentButton } from "./comment-form";

// 댓글 본문에서 실제로 언급한 사람의 "@닉네임"만 강조한다.
function CommentBody({ body, names }: { body: string; names: Set<string> }) {
  const parts = body.split(/(@[^\s@]+)/g);
  return (
    <p className="text-sm whitespace-pre-wrap break-words text-stone-700 dark:text-stone-300">
      {parts.map((part, i) =>
        part.startsWith("@") && names.has(part.slice(1)) ? (
          <span key={i} className="font-semibold text-brand-ink">
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </p>
  );
}

// 약속 댓글. 오래된 순으로 보여 주고, 아래에서 새 댓글을 쓴다.
export async function Comments({ eventId, groupId }: { eventId: string; groupId: string }) {
  const [comments, userId, group] = await Promise.all([
    getComments(eventId),
    getUserId(),
    getGroup(groupId),
  ]);
  const members = group?.members ?? [];
  const nicknameById = new Map(members.map((m) => [m.id, m.nickname]));

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
                      <DeleteCommentButton commentId={comment.id} />
                    </span>
                  )}
                </div>
                <CommentBody
                  body={comment.body}
                  names={
                    new Set(
                      comment.mentions.flatMap((id) => {
                        const name = nicknameById.get(id);
                        return name ? [name] : [];
                      }),
                    )
                  }
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      <CommentForm
        eventId={eventId}
        members={members
          .filter((m) => m.id !== userId)
          .map(({ id, nickname, kakaoName, avatarUrl, avatarColor }) => ({
            id,
            nickname,
            kakaoName,
            avatarUrl,
            avatarColor,
          }))}
      />
    </section>
  );
}
