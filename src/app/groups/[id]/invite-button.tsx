"use client";

import { useState } from "react";

// 휴대폰에서는 공유 시트(카카오톡 등)를 띄우고, 안 되면 링크를 복사한다.
export function InviteButton({ code, groupName }: { code: string; groupName: string }) {
  const [copied, setCopied] = useState(false);

  async function handleClick() {
    const url = `${window.location.origin}/invite/${code}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: `${groupName} 초대`, text: `jjoin에서 "${groupName}"에 초대했어요`, url });
        return;
      } catch (error) {
        // 사용자가 공유를 취소한 경우
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }

    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="h-12 rounded-xl bg-brand/10 font-medium text-brand-ink transition active:scale-[0.98]"
    >
      {copied ? "링크가 복사됐어요" : "친구 초대하기"}
    </button>
  );
}
