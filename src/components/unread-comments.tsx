"use client";

import { useEffect, useSyncExternalStore } from "react";
import { markEventNotificationsRead } from "@/app/(app)/notifications/actions";
import { closeSystemNotifications } from "@/lib/close-notifications";

// 약속을 마지막으로 본 시각. 기기마다 따로 저장한다. (그룹의 group-seen과 같은 방식)
const seenKey = (eventId: string) => `event-seen:${eventId}`;

function readSeen(eventId: string) {
  try {
    return localStorage.getItem(seenKey(eventId)) ?? "";
  } catch {
    return "";
  }
}

const noopSubscribe = () => () => {};

// 약속 카드 오른쪽 아래: 다른 사람이 쓴 댓글 중 내가 아직 안 본 개수. 0이면 안 보인다.
export function UnreadCommentsBadge({ eventId, commentTimes }: { eventId: string; commentTimes: string[] }) {
  // 서버는 본 기록을 모르므로 브라우저에서만 센다.
  const seen = useSyncExternalStore(noopSubscribe, () => readSeen(eventId), () => null);
  if (seen === null || commentTimes.length === 0) return null;

  const seenAt = seen ? Date.parse(seen) : 0;
  const unread = commentTimes.filter((time) => Date.parse(time) > seenAt).length;
  if (unread === 0) return null;

  return (
    <span
      className="reveal flex shrink-0 items-center gap-0.5 rounded-full bg-brand px-1.5 py-0.5 text-[11px] leading-none font-semibold text-white"
      aria-label={`안 읽은 댓글 ${unread}개`}
    >
      <svg viewBox="0 0 16 16" aria-hidden="true" className="size-3">
        <path
          d="M3 3h10a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H7l-3 2.5V11H3a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"
          fill="currentColor"
        />
      </svg>
      {unread}
    </span>
  );
}

// 약속 화면을 열면 "지금 봤음"을 기록해서 목록의 안 읽은 댓글 배지를 끈다.
// 이 약속에 대한 알림도 읽음으로 바꾸고, 휴대폰 알림 센터에 남은 알림도 닫는다.
export function MarkEventSeen({ eventId }: { eventId: string }) {
  useEffect(() => {
    try {
      localStorage.setItem(seenKey(eventId), new Date().toISOString());
    } catch {
      // 저장이 막힌 브라우저에서는 배지를 끄지 못할 뿐이다.
    }
    markEventNotificationsRead(eventId);
    closeSystemNotifications(`/events/${eventId}`);
  }, [eventId]);
  return null;
}
