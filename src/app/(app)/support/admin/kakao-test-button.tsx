"use client";

import { useState, useTransition } from "react";
import { sendTestKakao } from "../actions";

// 관리자: 카톡 시험 메시지 보내기
export function KakaoTestButton() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string>();
  return (
    <span className="flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await sendTestKakao();
            setMessage(result.sent ? "✓ 보냈어요. 카톡 '나와의 채팅'을 확인해 주세요." : result.error);
          })
        }
        className="rounded-full bg-white px-3 py-1 text-xs font-medium text-stone-700 disabled:opacity-50 dark:bg-stone-800 dark:text-stone-200"
      >
        {pending ? "보내는 중…" : "시험 메시지"}
      </button>
      {message && <span className="text-xs">{message}</span>}
    </span>
  );
}
