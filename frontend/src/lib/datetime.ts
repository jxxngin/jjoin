// 서버(Vercel)는 UTC로 돌기 때문에 시간은 항상 한국 시간 기준으로 다룬다.
const TIME_ZONE = "Asia/Seoul";

const dateFormat = new Intl.DateTimeFormat("ko-KR", {
  timeZone: TIME_ZONE,
  month: "long",
  day: "numeric",
  weekday: "short",
});

const timeFormat = new Intl.DateTimeFormat("ko-KR", {
  timeZone: TIME_ZONE,
  hour: "numeric",
  minute: "2-digit",
});

// "10월 18일 (일) 오후 7:00"
export function formatEventDate(iso: string) {
  const date = new Date(iso);
  return `${dateFormat.format(date)} ${timeFormat.format(date)}`;
}

// <input type="datetime-local">의 값("2026-10-18T19:00")을 한국 시간으로 해석한다.
export function fromKstInput(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(`${value}:00+09:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

// 저장된 시각을 <input type="datetime-local">에 넣을 한국 시간 문자열로 바꾼다.
export function toKstInput(iso: string) {
  const kst = new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 16);
}

// 한국 날짜 "2026-10-18"
export function kstDateKey(iso: string) {
  return toKstInput(iso).slice(0, 10);
}

// 한국 날짜 기준으로 며칠 남았는지. 오늘이면 0, 지난 날이면 null.
export function daysUntil(iso: string, now: number) {
  const day = (key: string) => Date.parse(`${key}T00:00:00Z`);
  const diff = Math.round(
    (day(kstDateKey(iso)) - day(kstDateKey(new Date(now).toISOString()))) / 86_400_000,
  );
  return diff < 0 ? null : diff;
}

// "오늘", "내일", "3일 후"
export function formatDaysLeft(days: number) {
  if (days === 0) return "오늘";
  if (days === 1) return "내일";
  return `${days}일 후`;
}

// "방금", "5분 전", "3시간 전", 하루가 넘으면 "10월 18일"
export function formatRelative(iso: string, now: number) {
  const minutes = Math.floor((now - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "방금";
  if (minutes < 60) return `${minutes}분 전`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)}시간 전`;
  const key = kstDateKey(iso);
  return `${Number(key.slice(5, 7))}월 ${Number(key.slice(8))}일`;
}

// 오늘 한국 날짜 "2026-10-18"
export function kstToday() {
  return kstDateKey(new Date().toISOString());
}

// "2026-10-18" 날짜 키 계산. 시간대와 상관없이 날짜만 다루려고 UTC 자정으로 계산한다.
const keyToUtc = (key: string) => Date.parse(`${key}T00:00:00Z`);
const utcToKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function addDays(key: string, days: number) {
  return utcToKey(keyToUtc(key) + days * 86_400_000);
}

// 그 날짜가 속한 주의 일요일
export function weekStart(key: string) {
  return addDays(key, -new Date(keyToUtc(key)).getUTCDay());
}

// "2026-10-18" 형식이 아니면 오늘로 바꾼다.
export function normalizeDateKey(value: string | undefined) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(keyToUtc(value))
    ? value
    : kstToday();
}

// 한국 날짜 [from, to) 범위를 실제 시각으로 바꾼다.
export function kstDayRange(fromKey: string, toKey: string) {
  return {
    from: new Date(`${fromKey}T00:00:00+09:00`),
    to: new Date(`${toKey}T00:00:00+09:00`),
  };
}

// 이전·다음 달 "2026-09", "2026-11"
export function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1 + delta, 1));
  return date.toISOString().slice(0, 7);
}

// 캘린더가 보여 줄 기간 [from, to)의 날짜 키. 주는 일요일부터 7일, 월은 그달 1일부터.
export function calendarRangeKeys(range: "week" | "month", anchor: string) {
  if (range === "week") {
    const start = weekStart(anchor);
    return { fromKey: start, toKey: addDays(start, 7) };
  }
  const month = anchor.slice(0, 7);
  return { fromKey: `${month}-01`, toKey: `${shiftMonth(month, 1)}-01` };
}

// ---- 여러 날 약속 (2박 3일 등) ----
// 끝나는 시각(ends_at)은 마지막 날 다음 날 0시(한국 시간)로 저장한다. 마지막 날 하루 종일이 기간에 들어간다.

// 마지막 날 "2026-10-26" → 저장할 끝나는 시각
export function endsAtFromLastDay(lastDayKey: string) {
  return new Date(`${addDays(lastDayKey, 1)}T00:00:00+09:00`);
}

// 저장된 끝나는 시각 → 마지막 날 "2026-10-26"
export function lastDayKey(endsAt: string) {
  return addDays(kstDateKey(endsAt), -1);
}

// "2박 3일", 하루면 "당일"
export function formatNights(firstKey: string, lastKey: string) {
  const nights = Math.round((keyToUtc(lastKey) - keyToUtc(firstKey)) / 86_400_000);
  return nights <= 0 ? "당일" : `${nights}박 ${nights + 1}일`;
}

// "10월 24일 (금)"
export function formatDay(key: string) {
  return dateFormat.format(new Date(`${key}T12:00:00+09:00`));
}

// 약속 날짜. 하루 약속은 "10월 18일 (일) 오후 7:00",
// 여러 날 약속은 "10월 24일 (금) 오전 10:00 ~ 10월 26일 (일) · 2박 3일"
export function formatEventPeriod(startsAt: string, endsAt: string | null) {
  if (!endsAt) return formatEventDate(startsAt);
  const last = lastDayKey(endsAt);
  return `${formatEventDate(startsAt)} ~ ${formatDay(last)} · ${formatNights(kstDateKey(startsAt), last)}`;
}

// 기간 투표 후보처럼 시간은 따로 보여 줄 때: "10월 24일 (금) ~ 10월 26일 (일) · 2박 3일"
export function formatDayRange(startsAt: string, endsAt: string) {
  const first = kstDateKey(startsAt);
  const last = lastDayKey(endsAt);
  return `${formatDay(first)} ~ ${formatDay(last)} · ${formatNights(first, last)}`;
}

// 화면에서 "2박 3일"을 날짜 옆 작은 배지로 따로 보여 줄 때 쓴다. (src/components/period.tsx)
// dates: "10월 24일 (금) 오전 10:00 ~ 10월 26일 (일)", nights: "2박 3일" (하루 약속이면 null)
// withTime이 false면 시간은 빼고 날짜만 (기간 투표 후보)
export function eventPeriodParts(startsAt: string, endsAt: string | null, withTime = true) {
  const start = withTime ? formatEventDate(startsAt) : formatDay(kstDateKey(startsAt));
  if (!endsAt) return { dates: start, nights: null };
  const last = lastDayKey(endsAt);
  return { dates: `${start} ~ ${formatDay(last)}`, nights: formatNights(kstDateKey(startsAt), last) };
}
