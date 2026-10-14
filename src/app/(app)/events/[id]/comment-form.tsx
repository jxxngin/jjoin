"use client";

import { useRef, useState, useTransition } from "react";
import { Avatar } from "@/components/avatar";
import type { AvatarColor } from "@/lib/avatar-style";
import { deleteComment, postComment } from "../comment-actions";

export type Mentionable = {
  id: string;
  nickname: string;
  kakaoName: string | null;
  avatarUrl: string | null;
  avatarColor: AvatarColor;
};

// 커서 바로 앞이 "@글자" 형태면 그 글자(검색어)와 시작 위치를 돌려준다.
function mentionQuery(text: string, cursor: number) {
  const match = /(^|\s)@([^\s@]*)$/.exec(text.slice(0, cursor));
  return match ? { query: match[2], start: cursor - match[2].length - 1 } : null;
}

export function CommentForm({ eventId, members }: { eventId: string; members: Mentionable[] }) {
  const [text, setText] = useState("");
  const [cursor, setCursor] = useState(0);
  const [mentioned, setMentioned] = useState<Mentionable[]>([]);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const textarea = useRef<HTMLTextAreaElement>(null);

  const active = mentionQuery(text, cursor);
  const suggestions = active
    ? members
        .filter((m) => !mentioned.some((picked) => picked.id === m.id))
        .filter((m) =>
          [m.nickname, m.kakaoName ?? ""].some((name) =>
            name.toLowerCase().includes(active.query.toLowerCase()),
          ),
        )
        .slice(0, 5)
    : [];

  // 고르면 입력칸의 "@검색어"는 지우고, 위쪽 칩으로만 보여 준다.
  function pick(member: Mentionable) {
    if (!active) return;
    const before = text.slice(0, active.start);
    const after = text.slice(cursor).replace(/^\s+/, "");
    setText(before + after);
    setMentioned((list) => (list.some((m) => m.id === member.id) ? list : [...list, member]));
    const position = before.length;
    setCursor(position);
    // 고른 뒤에도 바로 이어서 쓸 수 있게 커서를 원래 자리로 돌려놓는다.
    requestAnimationFrame(() => {
      textarea.current?.focus();
      textarea.current?.setSelectionRange(position, position);
    });
  }

  function unmention(member: Mentionable) {
    setMentioned((list) => list.filter((m) => m.id !== member.id));
  }

  // 칩으로 고른 사람들을 댓글 앞에 "@민수 @지원 "처럼 붙여서 저장한다. (등록된 댓글에서 강조됨)
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const ids = mentioned.map((m) => m.id);
    const prefix = mentioned.map((m) => `@${m.nickname} `).join("");
    const body = prefix + text.trim();
    setError(undefined);
    startTransition(async () => {
      const result = await postComment(eventId, body, ids);
      if (result.error) {
        setError(result.error);
        return;
      }
      setText("");
      setMentioned([]);
      setCursor(0);
    });
  }

  return (
    <form onSubmit={submit} className="relative flex flex-col gap-2">
      {suggestions.length > 0 && (
        <ul className="absolute bottom-full left-0 z-10 mb-2 flex w-60 flex-col overflow-hidden rounded-xl border border-stone-200 bg-background shadow-lg dark:border-stone-800">
          {suggestions.map((member) => (
            <li key={member.id}>
              <button
                type="button"
                // 누르는 순간 입력칸 포커스가 빠지지 않게 한다.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(member)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-stone-100 dark:hover:bg-stone-900"
              >
                <Avatar src={member.avatarUrl} color={member.avatarColor} size="xs" />
                <span className="font-medium">{member.nickname}</span>
                {member.kakaoName && member.kakaoName !== member.nickname && (
                  <span className="text-xs text-stone-500">({member.kakaoName})</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      {mentioned.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="언급할 친구">
          {mentioned.map((member) => (
            <li
              key={member.id}
              className="reveal flex items-center gap-1 rounded-full bg-brand/10 py-0.5 pr-1 pl-1 text-xs font-medium text-brand-ink"
            >
              <Avatar src={member.avatarUrl} color={member.avatarColor} size="xs" />
              <span>@{member.nickname}</span>
              <button
                type="button"
                onClick={() => unmention(member)}
                aria-label={`${member.nickname} 언급 취소`}
                className="flex size-4 items-center justify-center rounded-full text-brand-ink/70 hover:bg-brand/20"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-end gap-2">
        <textarea
          ref={textarea}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setCursor(e.target.selectionStart);
          }}
          onSelect={(e) => setCursor(e.currentTarget.selectionStart)}
          rows={1}
          maxLength={500}
          placeholder="댓글 남기기 · @로 친구 부르기"
          className="max-h-32 min-h-11 flex-1 resize-none rounded-xl border border-stone-300 bg-transparent px-3 py-2.5 text-sm outline-none [field-sizing:content] focus:border-brand dark:border-stone-700"
        />
        <button
          type="submit"
          disabled={pending || !text.trim()}
          className="h-11 shrink-0 rounded-xl bg-brand px-4 text-sm font-medium text-white disabled:opacity-50"
        >
          등록
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}

export function DeleteCommentButton({ commentId }: { commentId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (confirm("댓글을 지울까요?")) startTransition(() => deleteComment(commentId));
      }}
      className="shrink-0 text-xs text-stone-400 disabled:opacity-50"
    >
      삭제
    </button>
  );
}
