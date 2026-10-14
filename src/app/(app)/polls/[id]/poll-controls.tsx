"use client";

import { useOptimistic, useState, useTransition } from "react";
import { closePoll, confirmPoll, deletePoll, reopenPoll, toggleVote } from "../actions";

// 후보 날짜 옆 투표 버튼. 누르는 즉시 체크가 바뀌고, 서버 반영은 뒤에서 한다.
export function VoteButton({ optionId, voted }: { optionId: string; voted: boolean }) {
  const [optimistic, setOptimistic] = useOptimistic(voted);
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      aria-pressed={optimistic}
      onClick={() =>
        startTransition(async () => {
          setOptimistic(!optimistic);
          await toggleVote(optionId, !optimistic);
        })
      }
      className={`flex h-9 shrink-0 items-center gap-1 rounded-full px-3 text-sm font-medium transition active:scale-95 ${
        optimistic ? "bg-brand text-white" : "bg-stone-100 text-stone-600 dark:bg-stone-900 dark:text-stone-300"
      }`}
    >
      {optimistic ? "✓ 가능" : "가능해요"}
    </button>
  );
}

function useAction() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  function run(confirmText: string | null, action: () => Promise<{ error?: string }>) {
    if (confirmText && !confirm(confirmText)) return;
    setError(undefined);
    startTransition(async () => {
      const result = await action();
      if (result?.error) setError(result.error);
    });
  }
  return { pending, error, run };
}

// 만든 사람·방장: 투표 마감/다시 열기, 삭제
export function PollManage({ pollId, groupId, closed }: { pollId: string; groupId: string; closed: boolean }) {
  const { pending, error, run } = useAction();

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        {closed ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(null, () => reopenPoll(pollId))}
            className="h-11 flex-1 rounded-xl bg-stone-100 text-sm font-medium dark:bg-stone-900"
          >
            투표 다시 열기
          </button>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() => run("투표를 마감할까요? 마감하면 표가 많은 날짜 상위 3개를 보여 줘요.", () => closePoll(pollId))}
            className="h-11 flex-1 rounded-xl bg-stone-900 text-sm font-medium text-white dark:bg-white dark:text-stone-900"
          >
            투표 마감
          </button>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={() => run("투표를 삭제할까요?", () => deletePoll(pollId, groupId))}
          className="h-11 rounded-xl bg-red-50 px-4 text-sm font-medium text-red-600 dark:bg-red-950"
        >
          삭제
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

// 마감 결과에서 그 날짜로 약속을 만든다.
export function ConfirmButton({ pollId, optionId, label }: { pollId: string; optionId: string; label: string }) {
  const { pending, error, run } = useAction();

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          run(`${label}로 약속을 확정할까요? 이 날짜에 투표한 사람은 자동으로 참여해요.`, () =>
            confirmPoll(pollId, optionId),
          )
        }
        className="h-9 shrink-0 rounded-full bg-brand px-3 text-sm font-medium text-white transition active:scale-95 disabled:opacity-50"
      >
        {pending ? "확정 중…" : "이 날짜로 확정"}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
