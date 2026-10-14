"use client";

import { useEffect, useRef, useState } from "react";

// 약속 제목 옆의 작은 캘린더 버튼. 누르면 구글 캘린더·캘린더 파일 메뉴가 열린다.
export function CalendarMenu({ googleUrl, icsUrl }: { googleUrl: string; icsUrl: string }) {
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);

  // 바깥을 누르거나 Esc를 누르면 닫는다.
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !menu.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const item = "flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-stone-100 dark:hover:bg-stone-900";

  return (
    <div ref={menu} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="내 캘린더에 추가"
        aria-expanded={open}
        className="flex size-9 items-center justify-center rounded-full text-stone-500 transition hover:bg-stone-100 active:scale-95 dark:hover:bg-stone-900"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5">
          <path
            d="M7 3v3m10-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm7 7v5m-2.5-2.5h5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open && (
        <div
          role="menu"
          className="reveal absolute top-full right-0 z-20 mt-1 w-48 overflow-hidden rounded-xl border border-stone-200 bg-background shadow-lg dark:border-stone-800"
        >
          <p className="px-3 pt-2.5 pb-1 text-xs text-stone-500">내 캘린더에 추가</p>
          <a role="menuitem" href={googleUrl} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)} className={item}>
            구글 캘린더
          </a>
          <a role="menuitem" href={icsUrl} download onClick={() => setOpen(false)} className={item}>
            <span className="flex flex-col">
              캘린더 파일
              <span className="text-xs text-stone-500">(아이폰·아웃룩)</span>
            </span>
          </a>
        </div>
      )}
    </div>
  );
}
