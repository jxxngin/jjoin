"use client";

import { useEffect, useState } from "react";
import { isRecoverableError, reportClientError } from "@/lib/report-client-error";
import { TroubleSheet } from "./trouble-sheet";

// 화면 문제 감시. (로그인한 화면 공통 틀에 하나 둔다)
// - 잡히지 않은 오류는 모두 자동으로 기록한다. 그중 새로고침으로 풀리는 오류(새 배포 뒤 예전 파일, 네트워크 끊김)면 해결 팝업을 띄운다.
// - 불러오는 중 화면(뼈대, animate-pulse)이 오래 남아 있으면 "오래 걸려요" 팝업을 띄우고 기록한다.
const IGNORED = [/ResizeObserver loop/, /^Script error\.?$/];
const SLOW_MS = 10_000;

type Trouble = "broken" | "slow" | "offline" | null;

export function TroubleWatcher() {
  const [trouble, setTrouble] = useState<Trouble>(null);
  // 닫은 팝업은 같은 화면에서 다시 띄우지 않는다.
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    const show = (kind: Exclude<Trouble, null>) =>
      setTrouble((current) => (dismissed.has(`${kind}:${location.pathname}`) ? current : (current ?? kind)));

    function onProblem(message: string, stack: string | undefined) {
      if (!message || IGNORED.some((pattern) => pattern.test(message))) return;
      reportClientError(message, stack);
      if (isRecoverableError(message)) show(navigator.onLine ? "broken" : "offline");
    }
    const onError = (event: ErrorEvent) => onProblem(event.message || String(event.error), event.error?.stack);
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      onProblem(reason instanceof Error ? reason.message : String(reason), reason instanceof Error ? reason.stack : undefined);
    };
    const onOffline = () => show("offline");
    const onOnline = () => setTrouble((current) => (current === "offline" ? null : current));

    // 뼈대가 처음 보인 시각. 같은 뼈대가 SLOW_MS 넘게 남아 있으면 느린 것으로 본다.
    let skeletonSince: number | null = null;
    const timer = window.setInterval(() => {
      const loading = document.visibilityState === "visible" && document.querySelector(".animate-pulse");
      if (!loading) {
        skeletonSince = null;
        return;
      }
      skeletonSince ??= Date.now();
      if (Date.now() - skeletonSince > SLOW_MS) {
        const seconds = Math.round((Date.now() - skeletonSince) / 1000);
        reportClientError(`[느린 로딩] ${location.pathname} ${seconds}초 넘게 불러오는 중${navigator.onLine ? "" : " (오프라인)"}`);
        show(navigator.onLine ? "slow" : "offline");
        skeletonSince = null;
      }
    }, 1000);

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, [dismissed]);

  if (!trouble) return null;
  const close = () => {
    setDismissed((current) => new Set(current).add(`${trouble}:${location.pathname}`));
    setTrouble(null);
  };

  if (trouble === "offline") {
    return (
      <TroubleSheet
        title="📶 인터넷 연결이 끊겼어요"
        description="연결되면 다시 불러올 수 있어요."
        steps={["와이파이나 모바일 데이터가 켜져 있는지 확인해 주세요.", "연결된 뒤 '새로 불러오기'를 눌러 주세요."]}
        onClose={close}
      />
    );
  }
  if (trouble === "slow") {
    return (
      <TroubleSheet
        title="⏳ 불러오는 데 오래 걸리고 있어요"
        description="자동으로 알려 두었어요. 조금 더 기다리거나 아래 방법을 해 보세요."
        steps={[
          "인터넷 연결이 느린지 확인해 주세요.",
          "'새로 불러오기'로 화면을 다시 받아 보세요.",
          "그래도 그대로면 앱을 완전히 닫았다가 다시 열어 주세요.",
        ]}
        onClose={close}
        closeLabel="더 기다리기"
      />
    );
  }
  return (
    <TroubleSheet
      title="🔄 화면을 새로 불러와야 해요"
      description="앱이 업데이트됐거나 연결이 잠깐 끊겼어요. 자동으로 알려 두었어요."
      steps={["'새로 불러오기'를 눌러 주세요.", "그래도 안 되면 앱을 완전히 닫았다가 다시 열어 주세요."]}
      onClose={close}
    />
  );
}
