"use client";

import { useState } from "react";
import { formatNights } from "@/lib/datetime";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

// "2026-10-26" → "2026/10/26 (월)" (date-time-field.tsx와 같은 모양)
function formatDate(value: string) {
  const [y, m, d] = value.split("-").map(Number);
  return `${value.replaceAll("-", "/")} (${WEEKDAYS[new Date(y, m - 1, d).getDay()]})`;
}

// 여러 날 약속(여행 등)의 마지막 날. 처음엔 버튼만 보이고, 누르면 날짜 칸이 열린다.
// 서버에는 숨은 input으로 "2026-10-26"을 보낸다. 비우면 하루 약속이다.
export function EndDateField({
  name,
  defaultValue,
  startDate,
}: {
  name: string;
  defaultValue: string;
  // 시작하는 날 "2026-10-24". 아직 안 골랐으면 빈 문자열
  startDate: string;
}) {
  const [open, setOpen] = useState(defaultValue !== "");
  const [date, setDate] = useState(defaultValue);
  const nights = startDate && date && date > startDate ? formatNights(startDate, date) : null;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-11 rounded-xl border border-dashed border-stone-300 text-sm text-stone-500 dark:border-stone-700"
      >
        + 여러 날 약속이면 끝나는 날 추가 (여행 등)
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input type="hidden" name={name} value={date} />
      <div className="relative flex h-12 flex-1 items-center rounded-xl border border-stone-300 px-4 focus-within:border-brand dark:border-stone-700">
        <span className={date ? "" : "text-stone-400"}>{date ? formatDate(date) : "끝나는 날 선택"}</span>
        {nights && <span className="ml-auto text-sm font-medium text-brand-ink">{nights}</span>}
        <input
          type="date"
          value={date}
          min={startDate || undefined}
          onChange={(e) => setDate(e.target.value)}
          onClick={(e) => e.currentTarget.showPicker?.()}
          aria-label="끝나는 날"
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </div>
      <button
        type="button"
        onClick={() => {
          setDate("");
          setOpen(false);
        }}
        aria-label="끝나는 날 지우기 (하루 약속)"
        className="h-12 shrink-0 px-2 text-stone-400"
      >
        ×
      </button>
    </div>
  );
}
