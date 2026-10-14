"use client";

import Image from "next/image";
import { useEffect, useState, useSyncExternalStore } from "react";

const DISMISS_KEY = "install-banner-dismissed";

// 크롬 계열 브라우저가 설치 가능할 때 보내는 이벤트. 표준 타입에 없어서 직접 적는다.
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const noopSubscribe = () => () => {};

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function wasDismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

// 홈 화면에 앱으로 설치하라는 안내. 이미 설치했거나 닫았으면 보이지 않는다.
// 안드로이드·PC 크롬은 설치 버튼, 아이폰은 Safari 공유 메뉴 안내를 보여 준다.
export function InstallBanner() {
  // 서버에서는 설치 여부를 모르므로 아무것도 그리지 않는다.
  const hidden = useSyncExternalStore(
    noopSubscribe,
    () => isStandalone() || wasDismissed(),
    () => true,
  );
  const isIos = useSyncExternalStore(
    noopSubscribe,
    () => /iphone|ipad|ipod/i.test(navigator.userAgent),
    () => false,
  );
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      // 브라우저 기본 안내 대신 이 배너의 버튼으로 설치하게 한다.
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setClosed(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (hidden || closed || (!isIos && !installEvent)) return null;

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // 저장이 막혀 있으면 이번 화면에서만 닫는다.
    }
    setClosed(true);
  }

  async function install() {
    if (!installEvent) return;
    await installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    if (outcome === "accepted") setClosed(true);
    setInstallEvent(null);
  }

  return (
    <section className="flex items-center gap-3 rounded-2xl bg-brand/10 p-3">
      <Image src="/icons/icon-192.png" alt="" width={40} height={40} className="shrink-0 rounded-xl" />
      <div className="flex min-w-0 flex-1 flex-col text-sm">
        <span className="font-semibold">홈 화면에 jjoin 추가하기</span>
        <span className="text-stone-600 dark:text-stone-400">
          {isIos
            ? "Safari 아래 공유 버튼 → '홈 화면에 추가'를 눌러 주세요."
            : "앱처럼 바로 열 수 있어요."}
        </span>
      </div>
      {!isIos && (
        <button
          type="button"
          onClick={install}
          className="shrink-0 rounded-full bg-brand px-3 py-1.5 text-sm font-medium text-white"
        >
          설치
        </button>
      )}
      <button
        type="button"
        onClick={dismiss}
        aria-label="닫기"
        className="shrink-0 px-1 text-lg leading-none text-stone-500"
      >
        ×
      </button>
    </section>
  );
}
