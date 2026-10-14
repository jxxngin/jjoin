"use client";

import { useState } from "react";
import type { EventFormState, EventFormValues } from "@/app/(app)/events/actions";
import { EventForm } from "@/app/(app)/events/event-form";
import type { PollFormState } from "@/app/(app)/polls/actions";
import { PollForm } from "@/app/(app)/polls/poll-form";

type Mode = "event" | "poll";

// 날짜를 정했으면 바로 약속, 못 정했으면 후보 날짜로 투표를 올린다.
export function NewEventTabs({
  eventAction,
  pollAction,
  emptyValues,
}: {
  eventAction: (prev: EventFormState, formData: FormData) => Promise<EventFormState>;
  pollAction: (prev: PollFormState, formData: FormData) => Promise<PollFormState>;
  emptyValues: EventFormValues;
}) {
  const [mode, setMode] = useState<Mode>("event");

  const tab = (target: Mode) =>
    `flex-1 rounded-lg py-2 text-sm font-medium transition ${
      mode === target ? "bg-white shadow-sm dark:bg-stone-700" : "text-stone-500"
    }`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex rounded-xl bg-stone-100 p-1 dark:bg-stone-900" role="tablist">
        <button type="button" role="tab" aria-selected={mode === "event"} onClick={() => setMode("event")} className={tab("event")}>
          📅 날짜 정하기
        </button>
        <button type="button" role="tab" aria-selected={mode === "poll"} onClick={() => setMode("poll")} className={tab("poll")}>
          🗳️ 날짜 투표
        </button>
      </div>

      {/* 탭을 바꾸면 내용이 살짝 떠오르며 바뀐다. */}
      <div key={mode} className="reveal">
        {mode === "event" ? (
          <EventForm action={eventAction} initialValues={emptyValues} submitLabel="만들기" />
        ) : (
          <PollForm action={pollAction} />
        )}
      </div>
    </div>
  );
}
