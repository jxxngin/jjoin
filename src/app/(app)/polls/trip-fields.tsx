"use client";

import { useState } from "react";
import { addDays, formatNights } from "@/lib/datetime";

// 기간 투표(2박 3일 등)의 입력칸들. 서버에는 숨은 input으로 보낸다.
// - tripTime: 모든 후보에 공통인 출발 시간 "10:00"
// - tripStart / tripEnd: 후보마다 가는 날·오는 날 "2026-10-24", "2026-10-26"

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

const boxClass =
  "h-12 rounded-xl border border-stone-300 bg-transparent px-3 outline-none focus:border-brand dark:border-stone-700";

// "2026-10-24" → "10/24 (금)" (두 칸이 한 줄에 들어가게 짧게)
function shortDate(value: string) {
  const [y, m, d] = value.split("-").map(Number);
  return `${m}/${d} (${WEEKDAYS[new Date(y, m - 1, d).getDay()]})`;
}

// 출발 시간. 모든 후보에 같이 쓴다.
export function TripTimeField() {
  const [hour, setHour] = useState("10");
  const [minute, setMinute] = useState("00");
  return (
    <div className="flex items-center gap-2">
      <input type="hidden" name="tripTime" value={`${hour}:${minute}`} />
      <select value={hour} onChange={(e) => setHour(e.target.value)} aria-label="출발 시" className={`${boxClass} flex-1`}>
        {HOURS.map((h) => (
          <option key={h} value={h}>
            {h}시
          </option>
        ))}
      </select>
      <span className="text-stone-400">:</span>
      <select value={minute} onChange={(e) => setMinute(e.target.value)} aria-label="출발 분" className={`${boxClass} flex-1`}>
        {MINUTES.map((m) => (
          <option key={m} value={m}>
            {m}분
          </option>
        ))}
      </select>
    </div>
  );
}

function DateBox({
  label,
  value,
  min,
  onChange,
}: {
  label: string;
  value: string;
  min?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className={`${boxClass} relative flex min-w-0 flex-1 items-center`}>
      <span className={`truncate ${value ? "" : "text-stone-400"}`}>{value ? shortDate(value) : label}</span>
      <input
        type="date"
        value={value}
        min={min}
        onChange={(e) => onChange(e.target.value)}
        onClick={(e) => e.currentTarget.showPicker?.()}
        aria-label={label}
        className="absolute inset-0 cursor-pointer opacity-0"
      />
    </div>
  );
}

// 후보 하나: 가는 날 ~ 오는 날. 고르면 "2박 3일"을 보여 준다.
export function TripRangeField() {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const nights = start && end && end > start ? formatNights(start, end) : null;

  return (
    <div className="flex flex-col gap-1">
      <input type="hidden" name="tripStart" value={start} />
      <input type="hidden" name="tripEnd" value={end} />
      <div className="flex items-center gap-2">
        <DateBox
          label="가는 날"
          value={start}
          onChange={(value) => {
            setStart(value);
            // 오는 날이 가는 날보다 앞이 되면 비운다.
            if (end && value && end <= value) setEnd("");
          }}
        />
        <span className="text-stone-400">~</span>
        <DateBox label="오는 날" value={end} min={start ? addDays(start, 1) : undefined} onChange={setEnd} />
      </div>
      {nights && <span className="pl-1 text-xs font-medium text-brand-ink">{nights}</span>}
    </div>
  );
}
