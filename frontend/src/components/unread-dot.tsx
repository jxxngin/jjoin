"use client";

import { useSyncExternalStore } from "react";

// 머리글 종 아이콘의 "새 알림" 점.
// 머리글은 화면을 옮겨도 다시 그려지지 않아서, 알림 화면에서 모두 읽은 뒤 돌아와도 점이 남아 있었다.
// 그래서 브라우저에서 "모두 읽음" 신호를 받으면 바로 끈다. 그 뒤 새 알림이 오면 서버가 준 id가 달라져 다시 켜진다.

let readUpTo = 0;
const listeners = new Set<() => void>();

// 이 id까지는 읽었다고 알린다. (알림 화면을 열 때)
export function markNotificationsReadUpTo(id: number) {
  if (id <= readUpTo) return;
  readUpTo = id;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function UnreadDot({ latestUnreadId }: { latestUnreadId: number | null }) {
  const read = useSyncExternalStore(subscribe, () => readUpTo, () => 0);
  if (latestUnreadId === null || latestUnreadId <= read) return null;
  return <span className="absolute top-1 right-1 size-2.5 rounded-full border-2 border-background bg-brand" />;
}
