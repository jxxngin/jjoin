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
      <svg viewBox="0 0 24 24" aria-hidden="true" className="size-6">
        <path
          d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v10a1.5 1.5 0 0 1-1.5 1.5H10l-4 3.5V17h-.5A1.5 1.5 0 0 1 4 15.5v-10Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path
          d="M10 9a2 2 0 1 1 2.8 1.83c-.48.21-.8.68-.8 1.2V12.5M12 14.75v.25"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    </Link>
  );
}
