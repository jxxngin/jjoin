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
}: {
  eventId: string;
  myStatus: ParticipantStatus | null;
  isFull: boolean;
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
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
