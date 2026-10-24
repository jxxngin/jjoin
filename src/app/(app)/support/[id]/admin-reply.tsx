"use client";

import { useActionState, useState } from "react";
import { keepFormOnSubmit } from "@/lib/keep-form";
import { updateInquiry } from "../actions";

const STATUSES = [
  { value: "received", label: "접수" },
  { value: "in_progress", label: "확인 중" },
  { value: "done", label: "처리 완료" },
];

// 관리자: 상태를 바꾸고 답변을 쓴다. 답변을 새로 달면 문의한 사람에게 푸시 알림이 간다.
export function AdminReply({ id, status, reply }: { id: string; status: string; reply: string | null }) {
  const [state, formAction, pending] = useActionState(updateInquiry.bind(null, id), {});
  const [current, setCurrent] = useState(status);

  return (
    <form
      onSubmit={keepFormOnSubmit(formAction)}
      className="flex flex-col gap-3 rounded-2xl border-2 border-violet-200 p-4 dark:border-violet-900"
    >
      <span className="text-sm font-semibold text-violet-700 dark:text-violet-300">관리자</span>
      <input type="hidden" name="status" value={current} />
      <div className="grid grid-cols-3 gap-2">
        {STATUSES.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setCurrent(option.value)}
            className={`h-10 rounded-xl text-sm font-medium ${
              current === option.value
                ? "bg-violet-600 text-white"
                : "bg-stone-100 text-stone-600 dark:bg-stone-900 dark:text-stone-300"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      <textarea
        name="reply"
        defaultValue={reply ?? ""}
        maxLength={2000}
        rows={4}
        placeholder="답변 (비워 두면 답변 없이 상태만 바꿔요)"
        className="w-full rounded-xl border border-stone-300 bg-transparent px-4 py-3 text-base outline-none focus:border-violet-500 dark:border-stone-700"
      />
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="h-11 rounded-xl bg-violet-600 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "저장하는 중…" : "저장"}
      </button>
    </form>
  );
}
