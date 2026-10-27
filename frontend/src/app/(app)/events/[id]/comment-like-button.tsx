"use client";

import { useState } from "react";
import { toggleCommentLike } from "../comment-actions";

// 댓글 하트. 누르면 바로 빨간 하트와 숫자가 바뀌고, 서버 저장은 뒤에서 한다.
// 누른 상태는 이 버튼이 들고 있는다. (useOptimistic은 저장이 끝나면 서버의 예전 값으로 돌아가 하트가 풀렸다)
// 저장에 실패하면 원래대로 되돌린다.
// likers: 누른 사람 닉네임 (길게 누르거나 마우스를 올리면 보인다)
export function CommentLikeButton({
  commentId,
  liked,
  count,
  likers,
}: {
  commentId: string;
  liked: boolean;
  count: number;
  likers: string[];
}) {
  const [state, setState] = useState({ liked, count });

  async function toggle() {
    const before = state;
    const next = { liked: !state.liked, count: state.count + (state.liked ? -1 : 1) };
    setState(next);
    const result = await toggleCommentLike(commentId, next.liked);
    if (result.error) setState(before);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={state.liked}
      aria-label={state.liked ? "하트 취소" : "하트"}
      title={likers.length > 0 ? likers.join(", ") : undefined}
      className={`flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs transition active:scale-90 ${
        state.liked ? "text-rose-500" : "text-stone-400"
      }`}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className={`size-4 ${state.liked ? "animate-[heart-pop_250ms_ease-out]" : ""}`}>
        <path
          d="M12 20s-7-4.35-7-10a4 4 0 0 1 7-2.65A4 4 0 0 1 19 10c0 5.65-7 10-7 10Z"
          fill={state.liked ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
      {state.count > 0 && <span className="tabular-nums">{state.count}</span>}
    </button>
  );
}
