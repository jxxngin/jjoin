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

type Bound = {
  comment: CommentView;
  isMine: boolean;
  edit: (text: string) => Promise<{ error?: string }>;
  remove: () => Promise<void>;
};

// 댓글 한 줄: 작성자·시각·(본인이면) 수정·삭제가 한 줄, 그 아래 내용과 하트.
// 원 댓글에는 내용 아래 '답글 달기'가 붙는다. 답글이면 작게 그린다.
function CommentRow({ comment, isMine, edit, remove, isReply, onReply }: Bound & { isReply: boolean; onReply?: () => void }) {
  const [editing, setEditing] = useState(false);

  return (
    <div className="flex gap-3">
      <Avatar src={comment.author?.avatarUrl ?? null} color={comment.author?.avatarColor} size={isReply ? "xs" : "sm"} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        {/* 좁은 화면에서는 이름·시각이 글자 중간에서 끊기지 않고 덩어리째 다음 줄로 넘어간다. */}
        <div className="flex flex-wrap items-center gap-x-2 text-sm">
          {comment.author ? (
            <PersonName
              nickname={comment.author.nickname}
              kakaoName={comment.author.kakaoName}
              className="font-medium whitespace-nowrap"
            />
          ) : (
            <span className="text-stone-500">알 수 없음</span>
          )}
          <span className="text-xs whitespace-nowrap text-stone-400">
            {comment.timeLabel}
            {comment.edited && " · 수정됨"}
          </span>
          {isMine && !editing && (
            <span className="ml-auto flex shrink-0 items-center gap-1.5 text-xs text-stone-400">
              <button type="button" onClick={() => setEditing(true)}>
                수정
              </button>
              <span aria-hidden>·</span>
              <DeleteCommentButton remove={remove} />
            </span>
          )}
        </div>

        {editing ? (
          <EditForm comment={comment} edit={edit} done={() => setEditing(false)} />
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

        {onReply && !editing && (
          <button type="button" onClick={onReply} className="self-start text-xs font-medium text-stone-400">
            답글 달기
          </button>
        )}
      </div>
    </div>
  );
}

// 원 댓글과 그 답글들. 답글은 '── 답글 N개 보기'로 접혀 있다가 펼친다. (인스타그램처럼)
// 답글을 달면 바로 펼쳐서 내가 쓴 답글이 보이게 한다.
export function CommentThread({
  root,
  replies,
  reply,
  mentionables,
}: {
  root: Bound;
  replies: Bound[];
  reply: (body: string, mentionIds: string[]) => Promise<{ error?: string }>;
  mentionables: Mentionable[];
}) {
  const [open, setOpen] = useState(false);
  const [replying, setReplying] = useState(false);
  const author = root.comment.author;

  return (
    <div className="flex flex-col gap-2">
      <CommentRow {...root} isReply={false} onReply={() => setReplying(!replying)} />

      <div className="ml-11 flex flex-col gap-3">
        {replies.length > 0 && (
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="flex items-center gap-2 self-start text-xs font-medium text-stone-400"
          >
            <span aria-hidden className="h-px w-6 bg-stone-300 dark:bg-stone-700" />
            {open ? "답글 숨기기" : `답글 ${replies.length}개 보기`}
          </button>
        )}
        {open && replies.map((r) => <CommentRow key={r.comment.id} {...r} isReply />)}
        {replying && (
          <CommentForm
            post={async (body, mentionIds) => {
              const result = await reply(body, mentionIds);
              if (!result.error) {
                setReplying(false);
                setOpen(true);
              }
              return result;
            }}
            members={mentionables}
            placeholder={author ? `${author.nickname}님에게 답글` : "답글 남기기"}
          />
        )}
      </div>
    </div>
  );
}
