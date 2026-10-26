"use client";

import { useState, useTransition } from "react";
import { rerunAutofix, updateInquiry } from "../actions";

const STATUSES = [
  { value: "received", label: "접수" },
  { value: "in_progress", label: "확인 중" },
  { value: "on_hold", label: "보류" },
  { value: "done", label: "처리 완료" },
];

const PRIORITIES = [
  { value: "normal", label: "보통" },
  { value: "urgent", label: "🚨 긴급" },
];

// 관리자: 상태·우선순위를 바꾼다. (같은 문의로 묶인 문의도 같은 상태로) 오류 신고면 자동 수정을 다시 실행할 수 있다.
export function AdminPanel({
  id,
  status,
  priority,
  canRerun,
}: {
  id: string;
  status: string;
  priority: string;
  canRerun: boolean;
}) {
  const [current, setCurrent] = useState({ status, priority });
  const [message, setMessage] = useState<string>();
  const [pending, startTransition] = useTransition();
  const changed = current.status !== status || current.priority !== priority;

  const choice = (selected: boolean) =>
    `h-10 rounded-xl text-sm font-medium ${
      selected ? "bg-violet-600 text-white" : "bg-stone-100 text-stone-600 dark:bg-stone-900 dark:text-stone-300"
    }`;

  return (
    <section className="flex flex-col gap-3 rounded-2xl border-2 border-violet-200 p-4 dark:border-violet-900">
      <span className="text-sm font-semibold text-violet-700 dark:text-violet-300">관리자</span>
      <div className="grid grid-cols-4 gap-2">
        {STATUSES.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setCurrent({ ...current, status: option.value })}
            className={choice(current.status === option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {PRIORITIES.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setCurrent({ ...current, priority: option.value })}
            className={choice(current.priority === option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
      {message && <p className="text-sm text-stone-500">{message}</p>}
      <button
        type="button"
        disabled={pending || !changed}
        onClick={() =>
          startTransition(async () => {
            const result = await updateInquiry(id, current.status, current.priority);
            setMessage(result.error ?? "저장했어요.");
          })
        }
        className="h-11 rounded-xl bg-violet-600 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "저장하는 중…" : "상태 저장"}
      </button>
      {canRerun && (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await rerunAutofix(id);
              setMessage(result.error ?? "자동 수정을 다시 시작했어요.");
            })
          }
          className="h-10 rounded-xl border border-violet-300 text-sm font-medium text-violet-700 disabled:opacity-50 dark:border-violet-800 dark:text-violet-300"
        >
          🤖 자동 수정 다시 실행
        </button>
      )}
    </section>
  );
}
