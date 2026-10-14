"use client";

import { useState } from "react";

// 초대 링크를 복사한다. 복사가 막힌 브라우저에서만 공유 시트를 띄운다.
export function InviteButton({ code, groupName }: { code: string; groupName: string }) {
  const [copied, setCopied] = useState(false);

  async function handleClick() {
    const url = `${window.location.origin}/invite/${code}`;

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      return;
    } catch {
      // 일부 인앱 브라우저는 클립보드를 막는다.
    }

    if (navigator.share) {
      try {
        await navigator.share({ title: `${groupName} 초대`, text: `jjoin에서 "${groupName}"에 초대했어요`, url });
      } catch {
        // 사용자가 공유를 취소한 경우
      }
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="rounded-full bg-stone-900 px-3 py-1.5 text-sm font-medium text-white transition active:scale-[0.98] dark:bg-stone-100 dark:text-stone-900"
    >
      {copied ? "✓ 복사됨" : "🔗 초대 링크"}
    </button>
  );
}
