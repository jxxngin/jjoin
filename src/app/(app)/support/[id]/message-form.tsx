"use client";

import { useState, useTransition } from "react";
import { postInquiryMessage } from "../actions";

// 문의 대화에 글 남기기. 관리자면 답변, 문의한 사람이면 추가 내용이다.
export function MessageForm({ inquiryId, admin }: { inquiryId: string; admin: boolean }) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          const result = await postInquiryMessage(inquiryId, text);
          if (result.error) setError(result.error);
          else {
            setError(undefined);
            setText("");
          }
        });
      }}
      className="flex flex-col gap-2"
    >
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={2000}
        rows={3}
        placeholder={admin ? "답변 쓰기 (문의한 사람에게 알림이 가요)" : "더 알려 줄 내용이나 궁금한 점"}
        className={`w-full resize-none rounded-xl border border-stone-300 bg-transparent px-4 py-3 text-base outline-none [field-sizing:content] dark:border-stone-700 ${
          admin ? "focus:border-violet-500" : "focus:border-brand"
        }`}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={pending || !text.trim()}
        className={`h-11 rounded-xl text-sm font-medium text-white disabled:opacity-50 ${admin ? "bg-violet-600" : "bg-brand"}`}
      >
        {pending ? "보내는 중…" : admin ? "답변 보내기" : "보내기"}
      </button>
    </form>
  );
}
