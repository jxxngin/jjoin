"use client";

import { useEffect } from "react";
import { closeSystemNotifications } from "@/lib/close-notifications";
import { markAllNotificationsRead } from "./actions";

// 화면을 보여 준 뒤에 읽음 처리한다. (보는 동안엔 "새 알림" 표시가 남아 있다)
// 휴대폰 알림 센터에 남은 jjoin 알림도 함께 닫는다.
export function MarkRead() {
  useEffect(() => {
    markAllNotificationsRead();
    closeSystemNotifications();
  }, []);
  return null;
}
