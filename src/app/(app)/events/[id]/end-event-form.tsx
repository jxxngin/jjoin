"use client";

import { useActionState, useState } from "react";
import { END_REASON_LABELS, MANUAL_END_REASONS } from "@/lib/event-status";
import { endEvent } from "../actions";

// 만든 사람·방장이 시작 전에 약속을 종료한다. 처음엔 버튼만 보이고 누르면 사유를 고른다.
export function EndEventForm({ eventId }: { eventId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>("");
  const [state, formAction, pending] = useActionState(endEvent.bind(null, eventId), {});

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-12 flex-1 rounded-xl bg-stone-100 font-medium text-stone-600 dark:bg-stone-900 dark:text-stone-400"
      >
        약속 종료
      </button>
    );
  }

  return (
    <form action={formAction} className="flex w-full flex-col gap-3 rounded-2xl border border-stone-200 p-4 dark:border-stone-800">
      <p className="font-semibold">종료 사유를 골라 주세요</p>
      <div className="flex flex-wrap gap-2">
        {MANUAL_END_REASONS.map((value) => (
          <label
            key={value}
            className={`cursor-pointer rounded-full px-3 py-1.5 text-sm font-medium ${
              reason === value
                ? "bg-stone-900 text-white dark:bg-white dark:text-stone-900"
                : "bg-stone-100 text-stone-600 dark:bg-stone-900 dark:text-stone-400"
            }`}
          >
            <input
              type="radio"
              name="reason"
              value={value}
              checked={reason === value}
              onChange={() => setReason(value)}
              className="sr-only"
            />
            {END_REASON_LABELS[value]}
          </label>
        ))}
      </div>
      <input
        name="note"
        maxLength={100}
        required={reason === "other"}
        placeholder={reason === "other" ? "사유를 적어 주세요" : "한마디 남기기 (선택)"}
        className="h-11 rounded-xl border border-stone-300 bg-transparent px-3 text-base outline-none focus:border-brand dark:border-stone-700"
      />
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="h-11 flex-1 rounded-xl bg-stone-100 text-sm font-medium dark:bg-stone-900"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={pending || !reason}
          className="h-11 flex-1 rounded-xl bg-stone-900 text-sm font-medium text-white disabled:opacity-40 dark:bg-white dark:text-stone-900"
        >
          {pending ? "종료하는 중…" : "종료하기"}
        </button>
      </div>
    </form>
  );
}
