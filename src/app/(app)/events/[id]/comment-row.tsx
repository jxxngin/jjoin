"use client";

import { useState, useTransition } from "react";
import { Avatar } from "@/components/avatar";
import { PersonName } from "@/components/person-name";
import type { AvatarColor } from "@/lib/avatar-style";
import { splitMentions } from "@/lib/comment-text";
import { CommentForm, DeleteCommentButton, type Mentionable } from "./comment-form";
import { CommentLikeButton } from "./comment-like-button";

export type CommentView = {
  id: string;
  body: string;
  // 언급한 사람: 지금 닉네임 (그룹을 나갔으면 null → 저장된 이름)
  mentions: { id: string; name: string | null }[];
  timeLabel: string;
  edited: boolean;
  author: { id: string; nickname: string; kakaoName: string | null; avatarUrl: string | null; avatarColor: AvatarColor } | null;
  likes: { count: number; mine: boolean; names: string[] } | null;
};

// 댓글 내용. 언급 부분은 지금 닉네임으로 강조해서 그린다.
function CommentBody({ comment }: { comment: CommentView }) {
  const { names, rest } = splitMentions(comment.body, comment.mentions.length);
  return (
    <p className="text-sm whitespace-pre-wrap break-words text-stone-700 dark:text-stone-300">
      {names.map((stored, i) => (
        <span key={comment.mentions[i].id} className="font-semibold text-brand-ink">
          @{comment.mentions[i].name ?? stored}{" "}
        </span>
      ))}
      {rest}
    </p>
  );
}

// 댓글 내용 고치기. 언급(@이름)은 그대로 두고 내용만 바꾼다.
function EditForm({
  comment,
  edit,
  done,
}: {
  comment: CommentView;
  edit: (text: string) => Promise<{ error?: string }>;
  done: () => void;
}) {
  const { names, rest } = splitMentions(comment.body, comment.mentions.length);
  const [text, setText] = useState(rest);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          const result = await edit(text);
          if (result.error) setError(result.error);
          else done();
        });
      }}
      className="flex flex-col gap-2"
    >
      {names.length > 0 && (
        <span className="text-xs font-semibold text-brand-ink">{names.map((name) => `@${name}`).join(" ")}</span>
      )}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={500}
        rows={2}
        autoFocus
        className="w-full resize-none rounded-xl border border-stone-300 bg-transparent px-3 py-2 text-base outline-none [field-sizing:content] focus:border-brand dark:border-stone-700"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex justify-end gap-2 text-sm">
        <button type="button" onClick={done} className="px-2 text-stone-500">
          취소
        </button>
        <button
          type="submit"
          disabled={pending || !text.trim()}
          className="rounded-lg bg-brand px-3 py-1 font-medium text-white disabled:opacity-50"
        >
          {pending ? "저장 중…" : "저장"}
        </button>
      </div>
    </form>
  );
}

// 댓글 한 줄: 작성자, 시각, 내용, 하트, 답글·수정·삭제. 답글이면 작게 들여 그린다.
export function CommentRow({
  comment,
  isMine,
  isReply,
  edit,
  remove,
  reply,
  mentionables,
}: {
  comment: CommentView;
  isMine: boolean;
  isReply: boolean;
  edit: (text: string) => Promise<{ error?: string }>;
  remove: () => Promise<void>;
  // 답글 쓰기 (원 댓글에만 있다)
  reply: ((body: string, mentionIds: string[]) => Promise<{ error?: string }>) | null;
  mentionables: Mentionable[];
}) {
  const [mode, setMode] = useState<"view" | "edit" | "reply">("view");

  return (
    <div className={`flex gap-3 ${isReply ? "ml-11" : ""}`}>
      <Avatar src={comment.author?.avatarUrl ?? null} color={comment.author?.avatarColor} size={isReply ? "xs" : "sm"} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-2 text-sm">
          {comment.author ? (
            <PersonName nickname={comment.author.nickname} kakaoName={comment.author.kakaoName} className="font-medium" />
          ) : (
            <span className="text-stone-500">알 수 없음</span>
          )}
          <span className="text-xs text-stone-400">
            {comment.timeLabel}
            {comment.edited && " · 수정됨"}
          </span>
        </div>

        {mode === "edit" ? (
          <EditForm comment={comment} edit={edit} done={() => setMode("view")} />
        ) : (
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <CommentBody comment={comment} />
            </div>
            {comment.likes && (
              <CommentLikeButton
                // 다른 사람이 누른 하트가 새로 불러와지면 버튼을 새 값으로 다시 시작한다.
                key={`${comment.likes.count}-${comment.likes.mine}`}
                commentId={comment.id}
                liked={comment.likes.mine}
                count={comment.likes.count}
                likers={comment.likes.names}
              />
            )}
          </div>
        )}

        {mode !== "edit" && (
          <div className="flex items-center gap-3 text-xs text-stone-400">
            {reply && (
              <button type="button" onClick={() => setMode(mode === "reply" ? "view" : "reply")} className="font-medium">
                {mode === "reply" ? "답글 닫기" : "답글"}
              </button>
            )}
            {isMine && (
              <>
                <button type="button" onClick={() => setMode("edit")}>
                  수정
                </button>
                <DeleteCommentButton remove={remove} />
              </>
            )}
          </div>
        )}

        {mode === "reply" && reply && (
          <div className="mt-1">
            <CommentForm post={reply} members={mentionables} placeholder={comment.author ? `${comment.author.nickname}님에게 답글` : "답글 남기기"} />
          </div>
        )}
      </div>
    </div>
  );
}
