"use client";

import Link, { useLinkStatus } from "next/link";
import type { ReactNode } from "react";

// 목록/캘린더, 주/월처럼 둘 중 하나를 고르는 토글의 한 칸.
// 누르면 서버에서 새 내용을 받아 오는 동안에도 바로 선택된 것처럼 보이게 해서
// "안 눌렸나?" 하고 다시 누르지 않게 한다.
export function ToggleTab({
  href,
  active,
  transition,
  size = "md",
  children,
}: {
  href: string;
  active: boolean;
  transition: string;
  size?: "sm" | "md";
  children: ReactNode;
}) {
  const padding = size === "sm" ? "px-3 py-1 text-xs" : "px-3 py-1 text-sm";
  return (
    <Link
      href={href}
      replace
      scroll={false}
      transitionTypes={[transition]}
      className={`relative rounded-full font-medium ${padding} ${active ? "" : "text-stone-500"}`}
    >
      <Highlight active={active} />
      <span className="relative">{children}</span>
    </Link>
  );
}

function Highlight({ active }: { active: boolean }) {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden="true"
      className={`absolute inset-0 rounded-full bg-white shadow-sm transition-opacity duration-150 dark:bg-stone-700 ${
        active || pending ? "opacity-100" : "opacity-0"
      }`}
    />
  );
}
