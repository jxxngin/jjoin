"use client";

import { useTransition } from "react";
import { markNotificationsReadUpTo } from "@/components/unread-dot";
import { closeSystemNotifications } from "@/lib/close-notifications";
import { readAllNotifications } from "./actions";

// 알림 목록의 "모두 읽음". 새 알림 표시를 한 번에 끄고, 종의 점과 휴대폰 알림 센터의 jjoin 알림도 정리한다.
export function ReadAllButton({ latestId, unread }: { latestId: number; unread: number }) {
  const [pending, startTransition] = useTransition();
  if (unread === 0) return null;

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          markNotificationsReadUpTo(latestId);
          closeSystemNotifications();
          await readAllNotifications();
        })
      }
      className="rounded-full bg-brand/10 px-3 py-1.5 text-sm font-medium text-brand-ink disabled:opacity-50"
    >
      {pending ? "읽는 중…" : `모두 읽음 (${unread})`}
    </button>
  );
}
