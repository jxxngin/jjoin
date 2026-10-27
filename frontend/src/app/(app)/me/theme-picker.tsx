"use client";

import { useSyncExternalStore } from "react";
import { THEME_STORAGE_KEY, type ThemePreference } from "@/lib/theme";

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "시스템 설정" },
  { value: "light", label: "라이트" },
  { value: "dark", label: "다크" },
];

declare global {
  interface Window {
    // layout의 테마 스크립트가 등록한다.
    __applyTheme?: () => void;
  }
}

const listeners = new Set<() => void>();

function readPreference(): ThemePreference {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// 고른 테마를 저장하고 바로 적용한다.
function choose(value: ThemePreference) {
  try {
    if (value === "system") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, value);
    window.__applyTheme?.();
  } catch {
    // 저장이 막힌 브라우저에서는 이번 화면에만 바로 적용한다.
    const dark =
      value === "dark" ||
      (value === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }
  listeners.forEach((listener) => listener());
}

// 테마는 이 기기에만 저장된다. 선택 즉시 적용한다.
export function ThemePicker() {
  // 서버는 저장값을 모르므로 처음엔 아무것도 선택되지 않은 채로 그린다.
  const preference = useSyncExternalStore(subscribe, readPreference, () => null);

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">화면 테마</span>
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-stone-100 p-1 dark:bg-stone-900" role="radiogroup">
        {OPTIONS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={preference === value}
            onClick={() => choose(value)}
            className={`h-9 rounded-lg text-sm font-medium transition ${
              preference === value
                ? "bg-white shadow-sm dark:bg-stone-700"
                : "text-stone-500"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
