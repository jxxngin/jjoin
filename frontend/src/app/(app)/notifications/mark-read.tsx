"use client";

import { useEffect } from "react";
import { markNotificationsReadUpTo } from "@/components/unread-dot";
import { closeSystemNotifications } from "@/lib/close-notifications";
import { eventSeenKey, markSeen, pollSeenKey } from "@/lib/seen";
import { markAllNotificationsRead } from "./actions";

// 화면을 보여 준 뒤에 읽음 처리한다. (보는 동안엔 "새 알림" 표시가 남아 있다)
// 휴대폰 알림 센터에 남은 jjoin 알림도 함께 닫고, 머리글 종의 점도 바로 끈다.
// 알림 목록에서 댓글 내용을 이미 읽었으니, 약속·투표 카드의 안 읽은 댓글 배지도 그 댓글까지는 끈다.
export function MarkRead({
  latestId,
  comments,
}: {
  latestId: number;
  comments: { kind: "event" | "poll"; id: string; at: string }[];
}) {
  useEffect(() => {
    markAllNotificationsRead(latestId);
    closeSystemNotifications();
    markNotificationsReadUpTo(latestId);
    for (const { kind, id, at } of comments) markSeen(kind === "event" ? eventSeenKey(id) : pollSeenKey(id), [at], false);
    // 같은 알림 목록이면 한 번만 처리한다. (comments는 렌더마다 새 배열이다)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestId]);
  return null;
}
