import { y2025, y2026, y2027 } from "@hyunbinseo/holidays-kr/all";

// 대한민국 공휴일 (관보 기준, 대체공휴일·선거일·임시공휴일 포함). 달력에서 빨간날로 칠한다.
// 데이터는 @hyunbinseo/holidays-kr. 새 연도가 나오면 패키지를 올리고 여기에 그 해를 더한다.
const HOLIDAYS: Readonly<Record<string, readonly string[]>> = { ...y2025, ...y2026, ...y2027 };

// "2026-10-03" → "개천절". 같은 날 두 공휴일이면 "어린이날 · 부처님 오신 날". 공휴일이 아니면 null.
export function holidayName(dateKey: string): string | null {
  const names = HOLIDAYS[dateKey];
  return names ? names.join(" · ") : null;
}
