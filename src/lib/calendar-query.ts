// 캘린더 주소 값(?range=week|month&date=2026-10-18)을 읽는다.
// date는 들어온 그대로 두고, 비었거나 잘못되면 캘린더에서 오늘로 바꾼다. (현재 시각은 요청 시점에만 읽는다)
export type CalendarQuery = { range: "week" | "month"; date: string | undefined };

export function parseCalendarQuery(query: Record<string, string | string[] | undefined>): CalendarQuery {
  return {
    // 주 보기가 기본이다.
    range: query.range === "month" ? "month" : "week",
    date: typeof query.date === "string" ? query.date : undefined,
  };
}
