"use client";

import { useEffect } from "react";

// public/sw.js를 등록한다. 홈 화면 설치와 알림에 필요하다.
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch((error) => console.error("서비스 워커 등록 실패", error));
  }, []);

  return null;
}
