"use client";

import { useEffect } from "react";
import { markAllNotificationsRead } from "./actions";

// 화면을 보여 준 뒤에 읽음 처리한다. (보는 동안엔 "새 알림" 표시가 남아 있다)
export function MarkRead() {
  useEffect(() => {
    markAllNotificationsRead();
  }, []);
  return null;
}
