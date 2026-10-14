"use client";

import Link from "next/link";
import { useState } from "react";
import { EventCard } from "@/components/event-card";
import { statusStyles } from "@/components/status-badge";
import { kstDateKey, shiftMonth } from "@/lib/datetime";
import type { EventSummary } from "@/lib/events";
import { GROUP_COLORS, type GroupColor } from "@/lib/group-style";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export type CalendarItem = {
  event: EventSummary;
  // 여러 그룹의 약속을 함께 보여 줄 때만 있다. 있으면 칸 안 제목을 그룹 색으로 칠한다.
  group?: { name: string; emoji: string; color: GroupColor };
};

// 한 달 달력. 날짜를 누르면 그날 약속을 아래에 보여 준다.
export function Calendar({
  monthHrefBase,
  month,
  today,
  items,
}: {
  // 달을 넘기는 링크. 뒤에 &month=2026-11 이 붙는다. 예: "/?view=calendar"
  monthHrefBase: string;
  month: string; // "2026-10"
  today: string; // "2026-10-18"
  items: CalendarItem[];
}) {
  const [year, monthIndex] = month.split("-").map(Number);
  const firstWeekday = new Date(Date.UTC(year, monthIndex - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, monthIndex, 0)).getUTCDate();

  const itemsByDay = new Map<string, CalendarItem[]>();
  for (const item of items) {
    const key = kstDateKey(item.event.startsAt);
    itemsByDay.set(key, [...(itemsByDay.get(key) ?? []), item]);
  }

  const dayKey = (day: number) => `${month}-${String(day).padStart(2, "0")}`;
  const firstEventDay = items[0] ? kstDateKey(items[0].event.startsAt) : dayKey(1);
  const [selected, setSelected] = useState(today.startsWith(month) ? today : firstEventDay);
  const selectedItems = itemsByDay.get(selected) ?? [];

  const monthHref = (delta: number) => `${monthHrefBase}&month=${shiftMonth(month, delta)}`;
  const chipClass = (item: CalendarItem) =>
    item.group ? GROUP_COLORS[item.group.color].tile : statusStyles[item.event.status].className;

  // 그룹 색으로 칠했으면 범례도 그룹별로, 아니면 상태별로 보여 준다.
  const groups = new Map(
    items.flatMap((item) => (item.group ? [[item.group.name, item.group] as const] : [])),
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Link href={monthHref(-1)} className="px-3 py-1 text-stone-500" aria-label="이전 달">
          ‹
        </Link>
        <span className="font-semibold">
          {year}년 {monthIndex}월
        </span>
        <Link href={monthHref(1)} className="px-3 py-1 text-stone-500" aria-label="다음 달">
          ›
        </Link>
      </div>

      <div className="grid grid-cols-7 text-center text-xs text-stone-500">
        {WEEKDAYS.map((weekday, i) => (
          <span
            key={weekday}
            className={i === 0 ? "text-red-500" : i === 6 ? "text-sky-600" : undefined}
          >
            {weekday}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 border-t border-l border-stone-200 dark:border-stone-800">
        {Array.from({ length: firstWeekday }, (_, i) => (
          <span key={`blank-${i}`} className="border-r border-b border-stone-200 dark:border-stone-800" />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const key = dayKey(day);
          const dayItems = itemsByDay.get(key) ?? [];
          const isSelected = key === selected;
          const isToday = key === today;
          const weekday = (firstWeekday + i) % 7;

          return (
            <button
              key={key}
              type="button"
              onClick={() => setSelected(key)}
              aria-label={`${monthIndex}월 ${day}일, 약속 ${dayItems.length}개`}
              className={`flex min-h-20 min-w-0 flex-col gap-0.5 border-r border-b border-stone-200 p-0.5 text-left dark:border-stone-800 ${
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
                        ? "text-sky-600"
                        : ""
                }`}
              >
                {day}
              </span>
              {/* 칸이 좁아서 두 개까지 제목을 보여 주고 나머지는 개수만 표시한다. */}
              {dayItems.slice(0, 2).map((item) => (
                <span
                  key={item.event.id}
                  className={`truncate rounded px-1 text-[10px] leading-4 font-medium ${chipClass(item)} ${
                    item.event.status === "ended" ? "opacity-50" : ""
                  }`}
                >
                  {item.event.title}
                </span>
              ))}
              {dayItems.length > 2 && (
                <span className="px-1 text-[10px] leading-4 text-stone-500">
                  +{dayItems.length - 2}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-stone-500">
        {groups.size > 0
          ? [...groups.values()].map((group) => (
              <span key={group.name} className="flex items-center gap-1">
                <span className={`size-2.5 rounded-sm ${GROUP_COLORS[group.color].swatch}`} />
                {group.emoji} {group.name}
              </span>
            ))
          : (["recruiting", "full", "ended"] as const).map((status) => (
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
        {selectedItems.length === 0 ? (
          <p className="py-4 text-center text-sm text-stone-500">이날은 약속이 없어요.</p>
        ) : (
          selectedItems.map(({ event, group }) => (
            <EventCard key={event.id} event={event} groupName={group?.name} />
          ))
        )}
      </div>
    </div>
  );
}
