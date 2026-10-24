"use client";

import { useState, useTransition } from "react";
import { sendTestPush } from "../actions";

// 관리자: 문의 알림이 이 휴대폰에 오는지 시험 푸시를 보낸다.
export function PushTestButton() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string>();
  return (
    <span className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await sendTestPush();
            setMessage(result.sent ? "✓ 보냈어요. 알림이 왔는지 확인해 주세요." : result.error);
          })
        }
        className="rounded-full bg-violet-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
      >
        {pending ? "보내는 중…" : "시험 알림 보내기"}
      </button>
      {message && <span className="text-xs">{message}</span>}
    </span>
  );
}
