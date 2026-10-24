"use client";

import { useState } from "react";

// 약속 제목 옆 작은 링크 버튼. 누르면 약속 공유 링크를 복사한다.
// 링크에 그룹 초대 코드가 붙어 있어서, 그룹 밖 친구도 참여한 뒤 이 약속으로 바로 온다.
export function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 클립보드가 막힌 브라우저에서는 링크를 직접 보여 준다.
      window.prompt("아래 링크를 복사해 주세요", url);
    }
  }

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={copy}
        aria-label="약속 링크 복사"
        className="flex size-9 items-center justify-center rounded-full text-stone-500 transition active:scale-90 hover:bg-stone-100 dark:hover:bg-stone-900"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5">
          <path
            d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {copied && (
        <span
          role="status"
          className="reveal absolute top-full right-0 z-20 mt-1 rounded-full bg-stone-900/85 px-3 py-1 text-xs font-medium whitespace-nowrap text-white"
        >
          ✓ 링크를 복사했어요
        </span>
      )}
    </div>
  );
}
