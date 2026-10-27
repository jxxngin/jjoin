"use client";

import { useRef, useState, useTransition } from "react";
import { Avatar } from "@/components/avatar";
import type { AvatarColor } from "@/lib/avatar-style";

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

// post: 댓글을 저장하는 서버 함수 (약속 댓글·투표 댓글이 각자 넘겨준다)
// members: @로 부를 수 있는 사람. 비우면 @ 목록이 뜨지 않는다.
export function CommentForm({
  post,
  members,
  placeholder = "댓글 남기기 · @로 친구 부르기",
}: {
  placeholder?: string;
  post: (body: string, mentionIds: string[]) => Promise<{ error?: string }>;
  members: Mentionable[];
}) {
  const [text, setText] = useState("");
  const [cursor, setCursor] = useState(0);
  const [mentioned, setMentioned] = useState<Mentionable[]>([]);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const textarea = useRef<HTMLTextAreaElement>(null);
  // 한글처럼 글자를 조합하는 중인지. 조합 중에 보내면 마지막 글자가 빠진 채 올라가고,
  // 입력칸을 비운 뒤에 그 글자가 다시 들어와 "씹힌" 것처럼 보였다.
  const composing = useRef(false);
  const sendAfterCompose = useRef(false);
  const sending = useRef(false);

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
  // 내용은 화면 상태(text)가 아니라 입력칸에 실제로 들어 있는 글자를 읽는다. 조합이 막 끝난 글자까지 들어간다.
  function send() {
    const value = (textarea.current?.value ?? text).trim();
    if (!value || sending.current) return;
    sending.current = true;
    const ids = mentioned.map((m) => m.id);
    const prefix = mentioned.map((m) => `@${m.nickname} `).join("");
    setError(undefined);
    startTransition(async () => {
      const result = await post(prefix + value, ids);
      sending.current = false;
      if (result.error) {
        setError(result.error);
        return;
      }
      setText("");
      setMentioned([]);
      setCursor(0);
    });
  }

  // 조합 중이면 조합이 끝난 다음에 보낸다. 조합 끝 신호가 안 오는 키보드도 있어 잠시 뒤에는 그냥 보낸다.
  function requestSend() {
    if (!composing.current) {
      send();
      return;
    }
    sendAfterCompose.current = true;
    setTimeout(() => {
      if (!sendAfterCompose.current) return;
      sendAfterCompose.current = false;
      composing.current = false;
      send();
    }, 400);
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    requestSend();
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
          onCompositionStart={() => {
            composing.current = true;
          }}
          onCompositionEnd={() => {
            composing.current = false;
            if (!sendAfterCompose.current) return;
            sendAfterCompose.current = false;
            // 조합이 끝난 글자가 입력칸에 반영된 다음에 읽는다.
            setTimeout(send, 0);
          }}
          // 엔터로 등록, Shift+엔터로 줄바꿈. 친구 목록이 떠 있으면 엔터는 맨 위 친구를 고른다.
          onKeyDown={(e) => {
            if (e.key !== "Enter" && e.keyCode !== 229) return;
            if (e.shiftKey) return;
            // 조합 중의 엔터(키 코드 229 포함)는 글자 확정에 쓰이므로 막지 않고, 확정된 뒤에 보낸다.
            if (e.nativeEvent.isComposing || e.keyCode === 229) {
              if (e.key === "Enter" && suggestions.length === 0) {
                composing.current = true;
                requestSend();
              }
              return;
            }
            e.preventDefault();
            if (suggestions.length > 0) pick(suggestions[0]);
            else requestSend();
          }}
          enterKeyHint="send"
          rows={1}
          maxLength={500}
          placeholder={placeholder}
          className="max-h-32 min-h-11 flex-1 resize-none rounded-xl border border-stone-300 bg-transparent px-3 py-2.5 text-base outline-none [field-sizing:content] focus:border-brand dark:border-stone-700"
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

// remove: 그 댓글을 지우는 서버 함수 (id를 묶어서 넘겨준다)
export function DeleteCommentButton({ remove }: { remove: () => Promise<void> }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (confirm("댓글을 지울까요?")) startTransition(() => remove());
      }}
      className="shrink-0 text-xs text-stone-400 disabled:opacity-50"
    >
      삭제
    </button>
  );
}
