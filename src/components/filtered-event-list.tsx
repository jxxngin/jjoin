"use client";

import { useState } from "react";
import { EventCard } from "@/components/event-card";
import { statusStyles } from "@/components/status-badge";
import type { EventStatus } from "@/lib/event-status";
import type { EventSummary } from "@/lib/events";

export type EventListItem = {
  event: EventSummary;
  groupName?: string;
  countLabel?: string;
};

const STATUS_FILTERS: EventStatus[] = ["recruiting", "full", "ended"];

// 약속 목록. 위의 버튼으로 상태별로 걸러 본다.
// 기본은 모집중이고, 모집중 약속이 없으면 약속이 있는 첫 상태를 보여 준다.
export function FilteredEventList({ items, emptyText }: { items: EventListItem[]; emptyText: string }) {
  const count = (status: EventStatus) => items.filter((item) => item.event.status === status).length;
  const [filter, setFilter] = useState<EventStatus>(
    () => STATUS_FILTERS.find((status) => count(status) > 0) ?? "recruiting",
  );

  const visible = items.filter((item) => item.event.status === filter);
  // 종료된 약속이 없으면 그 버튼은 숨긴다.
  const filters = STATUS_FILTERS.filter((status) => status !== "ended" || count("ended") > 0);

  const chip = (active: boolean) =>
    `shrink-0 rounded-full px-3 py-1 text-sm font-medium transition ${
      active
        ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
        : "bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400"
    }`;

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
        {emptyText}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4">
        {filters.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setFilter(status)}
            className={chip(filter === status)}
          >
            {statusStyles[status].label} {count(status)}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="py-6 text-center text-sm text-zinc-500">
          {statusStyles[filter].label} 약속이 없어요.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map(({ event, groupName, countLabel }) => (
            <li key={event.id}>
              <EventCard event={event} groupName={groupName} countLabel={countLabel} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
