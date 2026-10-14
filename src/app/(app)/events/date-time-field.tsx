"use client";

import { useState } from "react";

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

const boxClass =
  "h-12 rounded-xl border border-stone-300 bg-transparent px-4 outline-none focus:border-brand dark:border-stone-700";

// "2026-10-18" → "2026/10/18 (일)"
function formatDate(value: string) {
  const [y, m, d] = value.split("-").map(Number);
  const weekday = WEEKDAYS[new Date(y, m - 1, d).getDay()];
  return `${value.replaceAll("-", "/")} (${weekday})`;
}

// 날짜는 yyyy/mm/dd로 보여 주고, 시간은 5분 단위로 고른다.
// 서버에는 숨은 input으로 "2026-10-18T19:00" 형식을 보낸다.
export function DateTimeField({ name, defaultValue }: { name: string; defaultValue: string }) {
  const [initialDate = "", initialTime = "19:00"] = defaultValue ? defaultValue.split("T") : [];
  const [initialHour, initialMinute] = initialTime.split(":");

  const [date, setDate] = useState(initialDate);
  const [hour, setHour] = useState(initialHour);
  const [minute, setMinute] = useState(initialMinute);

  // 예전에 5분 단위가 아닌 시각으로 저장된 약속도 그대로 보이게 한다.
  const minutes = MINUTES.includes(minute) ? MINUTES : [...MINUTES, minute].sort();

  return (
    <div className="flex flex-col gap-2">
      <input type="hidden" name={name} value={date ? `${date}T${hour}:${minute}` : ""} />

      <div className={`${boxClass} relative flex items-center`}>
        <span className={date ? "" : "text-stone-400"}>
          {date ? formatDate(date) : "날짜 선택"}
        </span>
        <input
          type="date"
          required
          value={date}
          onChange={(e) => setDate(e.target.value)}
          onClick={(e) => e.currentTarget.showPicker?.()}
          aria-label="날짜"
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </div>

      <div className="flex items-center gap-2">
        <select
          value={hour}
          onChange={(e) => setHour(e.target.value)}
          aria-label="시"
          className={`${boxClass} flex-1`}
        >
          {HOURS.map((h) => (
            <option key={h} value={h}>
              {h}시
            </option>
          ))}
        </select>
        <span className="text-stone-400">:</span>
        <select
          value={minute}
          onChange={(e) => setMinute(e.target.value)}
          aria-label="분"
          className={`${boxClass} flex-1`}
        >
          {minutes.map((m) => (
            <option key={m} value={m}>
              {m}분
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
