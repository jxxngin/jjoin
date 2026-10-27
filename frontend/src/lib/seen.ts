// "마지막으로 본 시각" 기록. 기기마다 브라우저(localStorage)에 저장한다. 브라우저에서만 쓴다.
// - group-seen:{그룹 id}  그룹 화면을 연 시각 (홈 그룹 동그라미의 새 소식 테두리)
// - event-seen:{약속 id}  약속 화면을 연 시각 (약속 카드의 안 읽은 댓글 배지, 그룹 새 소식)
//
// 기록이 바뀌면 화면에 떠 있는 배지·테두리도 바로 다시 계산하도록 구독을 제공한다.
// (뒤로 가기로 돌아온 화면은 다시 그려지지 않아서, 구독이 없으면 읽은 배지가 그대로 남았다)

export const groupSeenKey = (groupId: string) => `group-seen:${groupId}`;
export const eventSeenKey = (eventId: string) => `event-seen:${eventId}`;

const listeners = new Set<() => void>();

export function subscribeSeen(listener: () => void) {
  listeners.add(listener);
  // 다른 탭에서 바뀐 기록도 반영한다.
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export function readSeen(key: string): string {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

// 기기 시계가 서버보다 늦으면 방금 본 댓글이 "본 시각"보다 뒤로 찍혀 다시 안 읽음으로 떴다.
// 그래서 지금 시각과 화면에 보인 가장 최근 활동 시각 중 늦은 쪽을 본 시각으로 남긴다.
// untilNow가 false면 지금 시각은 빼고, 화면에 보인 활동까지만 본 것으로 친다. (알림 목록처럼 일부만 보일 때)
export function markSeen(key: string, latestShown: string[] = [], untilNow = true) {
  const latest = Math.max(
    untilNow ? Date.now() : 0,
    ...latestShown.map((time) => Date.parse(time)).filter(Number.isFinite),
  );
  if (latest === 0) return;
  const previous = Date.parse(readSeen(key));
  // 이미 더 늦은 시각이 남아 있으면 되돌리지 않는다.
  if (Number.isFinite(previous) && previous >= latest) return;
  try {
    localStorage.setItem(key, new Date(latest).toISOString());
  } catch {
    // 저장이 막힌 브라우저에서는 표시를 끄지 못할 뿐이다.
    return;
  }
  listeners.forEach((listener) => listener());
}
