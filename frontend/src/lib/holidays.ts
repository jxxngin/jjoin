import * as presets from "@hyunbinseo/holidays-kr/all";

// 대한민국 공휴일 (관보 기준, 대체공휴일·선거일·임시공휴일 포함). 달력에서 빨간날로 칠한다.
// 데이터는 @hyunbinseo/holidays-kr. 패키지에 새 연도·임시공휴일이 나오면 Dependabot이 PR을 올리고,
// 머지만 하면 그 해가 저절로 들어온다. (전체 데이터가 gzip 약 1.5KB라 연도를 고르지 않고 다 쓴다)

// 패키지 업데이트를 기다릴 수 없을 때 직접 넣는 공휴일. (예: 갑자기 지정된 임시공휴일)
// 패키지에 반영되면 지운다. 형식: "2026-12-31": "임시공휴일"
const EXTRA_HOLIDAYS: Record<string, string> = {};

const HOLIDAYS = new Map<string, string>();
for (const year of Object.values(presets) as Readonly<Record<string, readonly string[]>>[]) {
  for (const [date, names] of Object.entries(year)) HOLIDAYS.set(date, names.join(" · "));
}
for (const [date, name] of Object.entries(EXTRA_HOLIDAYS)) {
  const existing = HOLIDAYS.get(date);
  HOLIDAYS.set(date, existing && !existing.includes(name) ? `${existing} · ${name}` : (existing ?? name));
}

// "2026-10-03" → "개천절". 같은 날 두 공휴일이면 "어린이날 · 부처님 오신 날". 공휴일이 아니면 null.
export function holidayName(dateKey: string): string | null {
  return HOLIDAYS.get(dateKey) ?? null;
}
