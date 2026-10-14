"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";

// 이만큼(px) 끌어내리면 새로고침한다.
const THRESHOLD = 70;
const MAX_PULL = 110;

// 화면 맨 위에서 아래로 끌어내리면 새로고침한다.
// 홈 화면에 추가한 아이폰 앱에는 브라우저의 당겨서 새로고침이 없어서 직접 만든다.
// 브라우저 기본 동작은 globals.css의 overscroll-behavior로 꺼서 두 번 새로고침되지 않게 한다.
export function PullToRefresh() {
  const router = useRouter();
  const [pull, setPull] = useState(0);
  const [pending, startTransition] = useTransition();
  const start = useRef<number | null>(null);
  const pullRef = useRef(0);

  useEffect(() => {
    function onStart(e: TouchEvent) {
      start.current = window.scrollY <= 0 ? e.touches[0].clientY : null;
    }
    function onMove(e: TouchEvent) {
      if (start.current === null) return;
      const dy = e.touches[0].clientY - start.current;
      if (dy <= 0 || window.scrollY > 0) {
        pullRef.current = 0;
        setPull(0);
        return;
      }
      // 끌수록 덜 따라오게 해서 고무줄처럼 느껴지게 한다.
      pullRef.current = Math.min(MAX_PULL, dy * 0.5);
      setPull(pullRef.current);
    }
    function onEnd() {
      if (start.current === null) return;
      start.current = null;
      if (pullRef.current >= THRESHOLD) startTransition(() => router.refresh());
      pullRef.current = 0;
      setPull(0);
    }
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("touchcancel", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, [router]);

  const offset = pending ? THRESHOLD * 0.6 : pull * 0.6;
  if (offset === 0) return null;
  const ready = pull >= THRESHOLD;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center"
      style={{ transform: `translateY(calc(env(safe-area-inset-top) + ${offset}px))` }}
    >
      <span className="flex size-9 items-center justify-center rounded-full bg-background shadow-md ring-1 ring-stone-200 dark:ring-stone-800">
        <svg
          viewBox="0 0 24 24"
          aria-label={pending ? "새로고침 중" : undefined}
          className={`size-5 text-brand ${pending ? "animate-spin" : ""}`}
          style={pending ? undefined : { transform: `rotate(${pull * 3}deg)`, opacity: ready ? 1 : 0.5 }}
        >
          <path
            d="M20 12a8 8 0 1 1-2.34-5.66M20 4v4h-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </div>
  );
}

// 머리글 로고: 다른 화면에서는 홈으로 가고, 이미 홈이면 맨 위로 올리며 새로고침한다.
export function HomeLogoLink({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [, startTransition] = useTransition();

  return (
    <Link
      href="/"
      transitionTypes={["nav-back"]}
      aria-label="홈"
      className="flex items-center gap-2"
      onClick={(e) => {
        if (pathname !== "/") return;
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: "smooth" });
        startTransition(() => router.refresh());
      }}
    >
      {children}
    </Link>
  );
}
