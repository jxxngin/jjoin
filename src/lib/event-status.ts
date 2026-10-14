export type EventStatus = "recruiting" | "confirmed" | "full" | "past";

export type ParticipantStatus = "going" | "maybe" | "not_going" | "waitlisted";

// 상태는 저장하지 않고 참여 인원과 시각으로 계산한다. (PLAN.md 4. 약속 상태)
export function getEventStatus(
  event: { startsAt: string; minPeople: number | null; maxPeople: number | null },
  goingCount: number,
  now: number,
): EventStatus {
  if (new Date(event.startsAt).getTime() < now) return "past";
  if (event.maxPeople !== null && goingCount >= event.maxPeople) return "full";
  if (goingCount >= (event.minPeople ?? 1)) return "confirmed";
  return "recruiting";
}

// "3/6명", 정원이 없으면 "3명"
export function formatGoing(goingCount: number, maxPeople: number | null) {
  return maxPeople ? `${goingCount}/${maxPeople}명` : `${goingCount}명`;
}
