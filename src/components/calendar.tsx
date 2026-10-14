"use client";

import Link from "next/link";
import { useState } from "react";
import { EventCard } from "@/components/event-card";
import { statusStyles } from "@/components/status-badge";
import { addDays, kstDateKey, shiftMonth, weekStart } from "@/lib/datetime";
import type { EventSummary } from "@/lib/events";
import { GROUP_COLORS, type GroupColor } from "@/lib/group-style";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export type CalendarRange = "week" | "month";

export type CalendarItem = {
  event: EventSummary;
  // 여러 그룹의 약속을 함께 보여 줄 때만 있다. 있으면 칸 안 제목을 그룹 색으로 칠한다.
  group?: { name: string; emoji: string; color: GroupColor };
};

// 보여 줄 날짜들. 월 보기는 1일 앞을 빈칸으로 채운다.
function calendarDays(range: CalendarRange, anchor: string) {
  if (range === "week") {
    const start = weekStart(anchor);
    return { blanks: 0, days: Array.from({ length: 7 }, (_, i) => addDays(start, i)) };
  }
  const first = `${anchor.slice(0, 7)}-01`;
  const next = `${shiftMonth(anchor.slice(0, 7), 1)}-01`;
  const days: string[] = [];
  for (let day = first; day < next; day = addDays(day, 1)) days.push(day);
  return { blanks: new Date(`${first}T00:00:00Z`).getUTCDay(), days };
}

const md = (key: string) => `${Number(key.slice(5, 7))}월 ${Number(key.slice(8))}일`;

// 주·월 달력. 날짜를 누르면 그날 약속을 아래에 보여 준다.
export function Calendar({
  hrefBase,
  range,
  anchor,
  today,
  items,
}: {
  // 달력 링크의 앞부분. 뒤에 &range=week&date=2026-10-18 이 붙는다. 예: "/?view=calendar"
  hrefBase: string;
  range: CalendarRange;
  anchor: string; // 보여 줄 주·달에 속한 날짜 "2026-10-18"
  today: string;
  items: CalendarItem[];
}) {
  const { blanks, days } = calendarDays(range, anchor);
  const first = days[0];
  const last = days[days.length - 1];

  const itemsByDay = new Map<string, CalendarItem[]>();
  for (const item of items) {
    const key = kstDateKey(item.event.startsAt);
    itemsByDay.set(key, [...(itemsByDay.get(key) ?? []), item]);
  }

  const initial =
    today >= first && today <= last
      ? today
      : (days.find((day) => itemsByDay.has(day)) ?? first);
  const [selected, setSelected] = useState(initial);
  const selectedItems = itemsByDay.get(selected) ?? [];

  const href = (nextRange: CalendarRange, date: string) =>
    `${hrefBase}&range=${nextRange}&date=${date}`;
  const prev =
    range === "week" ? addDays(first, -7) : `${shiftMonth(first.slice(0, 7), -1)}-01`;
  const next =
    range === "week" ? addDays(first, 7) : `${shiftMonth(first.slice(0, 7), 1)}-01`;

  const title =
    range === "month"
      ? `${first.slice(0, 4)}년 ${Number(first.slice(5, 7))}월`
      : first.slice(0, 7) === last.slice(0, 7)
        ? `${md(first)} – ${Number(last.slice(8))}일`
        : `${md(first)} – ${md(last)}`;

  const chipClass = (item: CalendarItem) =>
    item.group ? GROUP_COLORS[item.group.color].tile : statusStyles[item.event.status].className;
  // 칸이 좁아서 월 보기는 두 개, 주 보기는 네 개까지 제목을 보여 주고 나머지는 개수만 표시한다.
  const maxChips = range === "week" ? 4 : 2;

  // 그룹 색으로 칠했으면 범례도 그룹별로, 아니면 상태별로 보여 준다.
  const groups = new Map(
    items.flatMap((item) => (item.group ? [[item.group.name, item.group] as const] : [])),
  );

  const rangeTab = (target: CalendarRange) =>
    `rounded-full px-2.5 py-0.5 text-xs font-medium ${
      range === target ? "bg-white shadow-sm dark:bg-stone-700" : "text-stone-500"
    }`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-1">
        <Link
          href={href(range, prev)}
          replace
          scroll={false}
          transitionTypes={["view-back"]}
          className="px-2 py-1 text-stone-500"
          aria-label={range === "week" ? "이전 주" : "이전 달"}
        >
          ‹
        </Link>
        <span className="min-w-0 flex-1 text-center font-semibold">{title}</span>
        <Link
          href={href(range, next)}
          replace
          scroll={false}
          transitionTypes={["view-forward"]}
          className="px-2 py-1 text-stone-500"
          aria-label={range === "week" ? "다음 주" : "다음 달"}
        >
          ›
        </Link>
        <div className="ml-1 flex rounded-full bg-stone-100 p-0.5 dark:bg-stone-900">
          <Link
            href={href("week", selected)}
            replace
            scroll={false}
            transitionTypes={["view-zoom"]}
            className={rangeTab("week")}
          >
            주
          </Link>
          <Link
            href={href("month", selected)}
            replace
            scroll={false}
            transitionTypes={["view-zoom"]}
            className={rangeTab("month")}
          >
            월
          </Link>
        </div>
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
        {Array.from({ length: blanks }, (_, i) => (
          <span key={`blank-${i}`} className="border-r border-b border-stone-200 dark:border-stone-800" />
        ))}
        {days.map((key) => {
          const dayItems = itemsByDay.get(key) ?? [];
          const isSelected = key === selected;
          const isToday = key === today;
          const weekday = new Date(`${key}T00:00:00Z`).getUTCDay();

          return (
            <button
              key={key}
              type="button"
              onClick={() => setSelected(key)}
              aria-label={`${md(key)}, 약속 ${dayItems.length}개`}
              className={`flex min-w-0 flex-col gap-0.5 border-r border-b border-stone-200 p-0.5 text-left dark:border-stone-800 ${
                range === "week" ? "min-h-32" : "min-h-20"
              } ${isSelected ? "bg-brand/10" : ""}`}
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
                {Number(key.slice(8))}
              </span>
              {dayItems.slice(0, maxChips).map((item) => (
                <span
                  key={item.event.id}
                  className={`truncate rounded px-1 text-[10px] leading-4 font-medium ${chipClass(item)} ${
                    item.event.status === "ended" ? "opacity-50" : ""
                  }`}
                >
                  {item.event.title}
                </span>
              ))}
              {dayItems.length > maxChips && (
                <span className="px-1 text-[10px] leading-4 text-stone-500">
                  +{dayItems.length - maxChips}
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
          {md(selected)} ({WEEKDAYS[new Date(`${selected}T00:00:00Z`).getUTCDay()]})
        </h3>
        {selectedItems.length === 0 ? (
          <p className="py-4 text-center text-sm text-stone-500">이날은 약속이 없어요.</p>
        ) : (
          selectedItems.map(({ event, group }) => (
            <EventCard key={event.id} event={event} group={group} />
          ))
        )}
      </div>
    </div>
  );
}
