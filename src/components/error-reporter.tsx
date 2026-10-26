"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

// 화면에서 난 오류(잡히지 않은 오류·거부된 Promise)를 client_errors 표에 남긴다. 관리자 화면에서 본다. (0028)
// 같은 오류는 이 탭에서 한 번만, 한 탭에서 최대 10개까지만 보낸다. (DB도 1시간 30개로 막는다)
const IGNORED = [/ResizeObserver loop/, /^Script error\.?$/];
const MAX_PER_TAB = 10;

export function ErrorReporter() {
  useEffect(() => {
    const sent = new Set<string>();

    function report(message: string, stack: string | undefined) {
      const text = message.trim().slice(0, 500);
      if (!text || IGNORED.some((pattern) => pattern.test(text)) || sent.has(text) || sent.size >= MAX_PER_TAB) return;
      sent.add(text);
      // 로그인하지 않았으면 정책 때문에 저장되지 않는다. 기록 실패는 무시한다.
      createClient()
        .from("client_errors")
        .insert({
          message: text,
          stack: stack?.slice(0, 4000) ?? null,
          page_path: location.pathname.slice(0, 300),
          user_agent: navigator.userAgent.slice(0, 400),
        })
        .then(
          () => {},
          () => {},
        );
    }

    const onError = (event: ErrorEvent) => report(event.message || String(event.error), event.error?.stack);
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      report(reason instanceof Error ? reason.message : String(reason), reason instanceof Error ? reason.stack : undefined);
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
