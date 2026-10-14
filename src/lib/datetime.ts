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
