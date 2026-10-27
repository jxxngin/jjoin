"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

// 머리글의 문의하기 아이콘. 누른 순간의 화면 주소를 ?from=으로 넘겨, 오류 신고에 어느 화면이었는지 남긴다.
export function SupportLink() {
  const router = useRouter();
  return (
    <Link
      href="/support"
      transitionTypes={["nav-forward"]}
      aria-label="문의하기"
      onClick={(e) => {
        if (window.location.pathname.startsWith("/support")) return;
        e.preventDefault();
        router.push(`/support?from=${encodeURIComponent(window.location.pathname + window.location.search)}`, {
          transitionTypes: ["nav-forward"],
        });
      }}
      className="flex size-8 items-center justify-center text-stone-600 dark:text-stone-300"
    >
      {/* 동그라미 속 물음표: 댓글 수의 말풍선과 헷갈리지 않게 */}
      <svg viewBox="0 0 24 24" aria-hidden="true" className="size-6">
        <circle cx="12" cy="12" r="8.25" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path
          d="M9.75 9.75a2.25 2.25 0 1 1 3.15 2.06c-.54.24-.9.77-.9 1.36v.33M12 16.25v.25"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    </Link>
  );
}
