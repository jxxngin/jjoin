"use client";

import { useEffect, useSyncExternalStore } from "react";
import { markEventSeen, markPollSeen } from "@/app/(app)/seen-actions";
import { closeSystemNotifications } from "@/lib/close-notifications";
import { eventSeenKey, markSeen, pollSeenKey, readSeen, subscribeSeen } from "@/lib/seen";

// 약속·투표 카드 오른쪽: 다른 사람이 쓴 댓글 중 내가 아직 안 본 개수. 0이면 안 보인다.
// seenKey: 이 기기의 본 기록 이름 (eventSeenKey / pollSeenKey)
// 본 시각은 서버 기록(모든 기기 공통)과 이 기기의 기록 중 늦은 쪽을 쓴다.
// 서버 기록은 화면을 다시 불러와야 바뀌므로, 방금 읽은 것은 이 기기 기록으로 바로 끈다.
export function UnreadCommentsBadge({
  seenKey,
  commentTimes,
  serverSeenAt,
}: {
  seenKey: string;
  commentTimes: string[];
  serverSeenAt: string | null;
}) {
  // 서버는 본 기록을 모르므로 브라우저에서만 센다.
  const seen = useSyncExternalStore(subscribeSeen, () => readSeen(seenKey), () => null);
  if (seen === null || commentTimes.length === 0) return null;

  const seenAt = Math.max(seen ? Date.parse(seen) : 0, serverSeenAt ? Date.parse(serverSeenAt) : 0);
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

// 약속 화면을 열면 "지금 봤음"을 기록해서 목록의 안 읽은 댓글 배지와 그룹 새 소식 테두리를 끈다.
// 이 약속에 대한 알림도 읽음으로 바꾸고, 휴대폰 알림 센터에 남은 알림도 닫는다.
// 보는 동안 새 댓글이 와서 화면이 다시 그려지면 그때도 다시 기록한다.
// seenUpTo: 화면에 실제로 보여 준 댓글까지의 시각(lib/comments.ts). 서버에는 이 시각까지만 본 것으로 남긴다.
export function MarkEventSeen({ eventId, commentTimes, seenUpTo }: { eventId: string; commentTimes: string[]; seenUpTo: string }) {
  const latest = commentTimes.reduce((a, b) => (a > b ? a : b), "");
  useEffect(() => {
    markSeen(eventSeenKey(eventId), latest ? [latest] : []);
    markEventSeen(eventId, seenUpTo);
    closeSystemNotifications(`/events/${eventId}`);
  }, [eventId, latest, seenUpTo]);
  return null;
}

// 투표 화면을 열면 "지금 봤음"을 기록해서 투표 카드의 안 읽은 댓글 배지를 끈다. (MarkEventSeen과 같다)
export function MarkPollSeen({ pollId, commentTimes, seenUpTo }: { pollId: string; commentTimes: string[]; seenUpTo: string }) {
  const latest = commentTimes.reduce((a, b) => (a > b ? a : b), "");
  useEffect(() => {
    markSeen(pollSeenKey(pollId), latest ? [latest] : []);
    markPollSeen(pollId, seenUpTo);
    closeSystemNotifications(`/polls/${pollId}`);
  }, [pollId, latest, seenUpTo]);
  return null;
}
