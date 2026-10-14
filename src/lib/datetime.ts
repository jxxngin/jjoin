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

// 오늘 한국 날짜 "2026-10-18"
export function kstToday() {
  return kstDateKey(new Date().toISOString());
}

// "2026-10" 형식이 아니면 이번 달로 바꾼다.
export function normalizeMonth(value: string | undefined) {
  return value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? value : kstToday().slice(0, 7);
}

// 한 달 범위 [from, to). month는 "2026-10"
export function kstMonthRange(month: string) {
  const [y, m] = month.split("-").map(Number);
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  return {
    from: new Date(`${month}-01T00:00:00+09:00`),
    to: new Date(`${next}-01T00:00:00+09:00`),
  };
}

// 이전·다음 달 "2026-09", "2026-11"
export function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1 + delta, 1));
  return date.toISOString().slice(0, 7);
}
