export type EventStatus = "recruiting" | "full" | "ended";

export type ParticipantStatus = "going" | "maybe" | "not_going" | "waitlisted";

// time_passed는 저장하지 않는다. 시작 시각이 지나면 화면에서 자동으로 붙인다.
export type EndReason =
  | "time_passed"
  | "not_enough_people"
  | "cancelled"
  | "schedule_conflict"
  | "weather"
  | "other";

export const END_REASON_LABELS: Record<EndReason, string> = {
  time_passed: "기간 종료",
  not_enough_people: "인원 미달",
  cancelled: "갑작스러운 파토",
  schedule_conflict: "일정이 안 맞음",
  weather: "날씨",
  other: "기타",
};

// 직접 종료할 때 고를 수 있는 사유
export const MANUAL_END_REASONS = [
  "not_enough_people",
  "cancelled",
  "schedule_conflict",
  "weather",
  "other",
] as const satisfies readonly EndReason[];

// 상태는 참여 인원·시각·종료 여부로 계산한다.
export function getEventStatus(
  event: { startsAt: string; maxPeople: number | null; endedAt: string | null },
  goingCount: number,
  now: number,
): EventStatus {
  if (event.endedAt || new Date(event.startsAt).getTime() < now) return "ended";
  if (event.maxPeople !== null && goingCount >= event.maxPeople) return "full";
  return "recruiting";
}

// 직접 종료했으면 그 사유, 시간이 지났으면 기간 종료, 아니면 null
export function getEndReason(
  event: { startsAt: string; endReason: EndReason | null },
  now: number,
): EndReason | null {
  if (event.endReason) return event.endReason;
  return new Date(event.startsAt).getTime() < now ? "time_passed" : null;
}

// "3/6명", 정원이 없으면 "3명"
export function formatGoing(goingCount: number, maxPeople: number | null) {
  return maxPeople ? `${goingCount}/${maxPeople}명` : `${goingCount}명`;
}
