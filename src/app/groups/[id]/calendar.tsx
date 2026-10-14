"use client";

import Link from "next/link";
import { useState } from "react";
import { EventCard } from "@/components/event-card";
import { statusStyles } from "@/components/status-badge";
import { kstDateKey, shiftMonth } from "@/lib/datetime";
import type { EventSummary } from "@/lib/events";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

// 한 달 달력. 날짜를 누르면 그날 약속을 아래에 보여 준다.
export function Calendar({
  groupId,
  month,
  today,
  events,
}: {
  groupId: string;
  month: string; // "2026-10"
  today: string; // "2026-10-18"
  events: EventSummary[];
}) {
  const [year, monthIndex] = month.split("-").map(Number);
  const firstWeekday = new Date(Date.UTC(year, monthIndex - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, monthIndex, 0)).getUTCDate();

  const eventsByDay = new Map<string, EventSummary[]>();
  for (const event of events) {
    const key = kstDateKey(event.startsAt);
    eventsByDay.set(key, [...(eventsByDay.get(key) ?? []), event]);
  }

  const dayKey = (day: number) => `${month}-${String(day).padStart(2, "0")}`;
  const firstEventDay = events[0] ? kstDateKey(events[0].startsAt) : dayKey(1);
  const [selected, setSelected] = useState(today.startsWith(month) ? today : firstEventDay);
  const selectedEvents = eventsByDay.get(selected) ?? [];

  const monthHref = (delta: number) =>
    `/groups/${groupId}?view=calendar&month=${shiftMonth(month, delta)}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Link href={monthHref(-1)} className="px-3 py-1 text-zinc-500" aria-label="이전 달">
          ‹
        </Link>
        <span className="font-semibold">
          {year}년 {monthIndex}월
        </span>
        <Link href={monthHref(1)} className="px-3 py-1 text-zinc-500" aria-label="다음 달">
          ›
        </Link>
      </div>

      <div className="grid grid-cols-7 text-center text-xs text-zinc-500">
        {WEEKDAYS.map((weekday, i) => (
          <span
            key={weekday}
            className={i === 0 ? "text-red-500" : i === 6 ? "text-brand" : undefined}
          >
            {weekday}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 border-t border-l border-zinc-200 dark:border-zinc-800">
        {Array.from({ length: firstWeekday }, (_, i) => (
          <span key={`blank-${i}`} className="border-r border-b border-zinc-200 dark:border-zinc-800" />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const key = dayKey(day);
          const dayEvents = eventsByDay.get(key) ?? [];
          const isSelected = key === selected;
          const isToday = key === today;
          const weekday = (firstWeekday + i) % 7;

          return (
            <button
              key={key}
              type="button"
              onClick={() => setSelected(key)}
              aria-label={`${monthIndex}월 ${day}일, 약속 ${dayEvents.length}개`}
              className={`flex min-h-20 min-w-0 flex-col gap-0.5 border-r border-b border-zinc-200 p-0.5 text-left dark:border-zinc-800 ${
                isSelected ? "bg-brand/10" : ""
              }`}
            >
              <span
                className={`flex size-6 items-center justify-center self-center rounded-full text-xs ${
                  isToday
                    ? "bg-brand font-semibold text-white"
                    : weekday === 0
                      ? "text-red-500"
                      : weekday === 6
                        ? "text-brand"
                        : ""
                }`}
              >
                {day}
              </span>
              {/* 칸이 좁아서 두 개까지 제목을 보여 주고 나머지는 개수만 표시한다. */}
              {dayEvents.slice(0, 2).map((event) => (
                <span
                  key={event.id}
                  className={`truncate rounded px-1 text-[10px] leading-4 font-medium ${statusStyles[event.status].className}`}
                >
                  {event.title}
                </span>
              ))}
              {dayEvents.length > 2 && (
                <span className="px-1 text-[10px] leading-4 text-zinc-500">
                  +{dayEvents.length - 2}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-500">
        {(["recruiting", "full", "ended"] as const).map((status) => (
          <span key={status} className="flex items-center gap-1">
            <span className={`size-2.5 rounded-sm ${statusStyles[status].className}`} />
            {statusStyles[status].label}
          </span>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">
          {Number(selected.slice(5, 7))}월 {Number(selected.slice(8))}일 (
          {WEEKDAYS[new Date(`${selected}T00:00:00Z`).getUTCDay()]})
        </h3>
        {selectedEvents.length === 0 ? (
          <p className="py-4 text-center text-sm text-zinc-500">이날은 약속이 없어요.</p>
        ) : (
          selectedEvents.map((event) => <EventCard key={event.id} event={event} />)
        )}
      </div>
    </div>
  );
}
