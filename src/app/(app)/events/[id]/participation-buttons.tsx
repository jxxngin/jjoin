"use client";

import { useState, useTransition } from "react";
import type { ParticipantStatus } from "@/lib/event-status";
import { setParticipation } from "../actions";

const OPTIONS = [
  { value: "going", label: "참여" },
  { value: "maybe", label: "미정" },
  { value: "not_going", label: "불참" },
] as const;

function goingLabel(myStatus: ParticipantStatus | null, isFull: boolean) {
  if (myStatus === "waitlisted") return "대기 중";
  if (isFull && myStatus !== "going") return "대기 신청";
  return "참여";
}

export function ParticipationButtons({
  eventId,
  myStatus,
  isFull,
  waitlistRank,
}: {
  eventId: string;
  myStatus: ParticipantStatus | null;
  isFull: boolean;
  // 대기 중이면 1부터 시작하는 순번
  waitlistRank: number | null;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  // 대기 중이면 "참여" 버튼이 선택된 것으로 보여 준다.
  const selected = myStatus === "waitlisted" ? "going" : myStatus;

  function choose(status: (typeof OPTIONS)[number]["value"]) {
    if (status === selected) return;
    setError(undefined);
    startTransition(async () => {
      const result = await setParticipation(eventId, status);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-3 gap-2">
        {OPTIONS.map(({ value, label }) => {
          const active = value === selected;
          return (
            <button
              key={value}
              type="button"
              disabled={pending}
              onClick={() => choose(value)}
              className={`h-12 rounded-xl font-medium transition active:scale-[0.98] disabled:opacity-60 ${
                active
                  ? "bg-brand text-white"
                  : "bg-stone-100 text-stone-700 dark:bg-stone-900 dark:text-stone-300"
              }`}
            >
              {value === "going" ? goingLabel(myStatus, isFull) : label}
            </button>
          );
        })}
      </div>
      {/* 대기 중일 때는 그만두는 방법이 안 보여 헷갈렸다. 순번 옆에 바로 취소 버튼을 둔다. */}
      {waitlistRank && (
        <div className="flex items-center gap-2 rounded-xl bg-stone-100 px-3 py-2.5 text-sm dark:bg-stone-900">
          <p className="min-w-0 flex-1 text-stone-600 dark:text-stone-400">
            대기 <b className="text-foreground">{waitlistRank}번째</b>예요. 자리가 나면 자동으로 참여돼요.
          </p>
          <button
            type="button"
            disabled={pending}
            onClick={() => choose("not_going")}
            className="shrink-0 rounded-full border border-stone-300 px-3 py-1 text-sm font-medium text-stone-600 disabled:opacity-60 dark:border-stone-700 dark:text-stone-300"
          >
            대기 취소
          </button>
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
