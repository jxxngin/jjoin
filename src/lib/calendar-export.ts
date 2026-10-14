// 약속을 개인 캘린더(구글, 애플, 아웃룩)로 내보낸다. 끝나는 시각이 없어서 2시간짜리로 넣는다.
const DURATION_MS = 2 * 60 * 60 * 1000;

type Exportable = {
  id: string;
  title: string;
  startsAt: string;
  placeName: string | null;
  address: string | null;
  memo: string | null;
};

// 20261018T100000Z
function utcStamp(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function location(event: Exportable) {
  return [event.placeName, event.address].filter(Boolean).join(", ");
}

export function googleCalendarUrl(event: Exportable, url: string) {
  const start = new Date(event.startsAt);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${utcStamp(start)}/${utcStamp(new Date(start.getTime() + DURATION_MS))}`,
    location: location(event),
    details: [event.memo, url].filter(Boolean).join("\n\n"),
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

// iCalendar 글자 규칙: 역슬래시·쉼표·세미콜론은 이스케이프, 줄바꿈은 \n
function escape(text: string) {
  return text.replace(/\\/g, "\\\\").replace(/([,;])/g, "\\$1").replace(/\r?\n/g, "\\n");
}

export function icsFor(event: Exportable, url: string, now: Date) {
  const start = new Date(event.startsAt);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//jjoin//KO",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${event.id}@jjoin`,
    `DTSTAMP:${utcStamp(now)}`,
    `DTSTART:${utcStamp(start)}`,
    `DTEND:${utcStamp(new Date(start.getTime() + DURATION_MS))}`,
    `SUMMARY:${escape(event.title)}`,
    location(event) && `LOCATION:${escape(location(event))}`,
    `DESCRIPTION:${escape([event.memo, url].filter(Boolean).join("\n\n"))}`,
    `URL:${url}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);
  // 줄 끝은 CRLF여야 한다.
  return lines.join("\r\n") + "\r\n";
}
