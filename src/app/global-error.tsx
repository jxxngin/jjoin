"use client";

import { useEffect } from "react";
import { ErrorScreen } from "@/components/error-screen";
import { THEME_STORAGE_KEY } from "@/lib/theme";
import "./globals.css";

// 맨 바깥 틀(app/layout.tsx)에서 오류가 났을 때. 틀 대신 그려지므로 html·body와 테마를 직접 챙긴다.
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    try {
      const pref = localStorage.getItem(THEME_STORAGE_KEY) ?? "system";
      const dark = pref === "dark" || (pref === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
      document.documentElement.dataset.theme = dark ? "dark" : "light";
    } catch {}
  }, []);

  return (
    <html lang="ko">
      <body className="flex min-h-dvh flex-col">
        <title>jjoin · 문제가 생겼어요</title>
        <ErrorScreen error={error} retry={retry} />
      </body>
    </html>
  );
}
