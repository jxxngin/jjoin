"use client";

import { useEffect, useState, useSyncExternalStore, useTransition } from "react";
import type { NotificationPrefs } from "@/lib/auth";
import {
  removePushSubscription,
  savePushSubscription,
  sendTestNotification,
  updateNotificationPref,
  type NotificationPref,
} from "./notification-actions";

const PREF_LABELS: { key: NotificationPref; label: string; hint: string }[] = [
  { key: "newEvent", label: "새 약속", hint: "내 그룹에 약속이 생기면" },
  { key: "promoted", label: "대기 승격", hint: "대기하던 약속에 자리가 나면" },
  { key: "dayBefore", label: "하루 전", hint: "참여하는 약속 전날 오전 10시" },
];

// 서버 공개 키(base64url)를 브라우저가 원하는 바이트 배열로 바꾼다.
function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

type Support = "unknown" | "supported" | "unsupported" | "ios-needs-install";

const noopSubscribe = () => () => {};

function detectSupport(): Support {
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  // 아이폰은 홈 화면에 추가한 앱에서만 웹 푸시를 받을 수 있다.
  if (isIos && !standalone) return "ios-needs-install";
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window
    ? "supported"
    : "unsupported";
}

export function NotificationSettings({ prefs: initialPrefs }: { prefs: NotificationPrefs }) {
  const support = useSyncExternalStore(noopSubscribe, detectSupport, () => "unknown" as const);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [prefs, setPrefs] = useState(initialPrefs);
  const [message, setMessage] = useState<string>();
  const [pending, startTransition] = useTransition();

  // 이 기기가 이미 구독 중인지 확인한다.
  useEffect(() => {
    if (support !== "supported") return;
    navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then(setSubscription)
      .catch(() => setSubscription(null));
  }, [support]);

  function turnOn() {
    setMessage(undefined);
    startTransition(async () => {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setMessage("브라우저에서 알림이 차단돼 있어요. 사이트 설정에서 알림을 허용해 주세요.");
        return;
      }
      try {
        const registration = await navigator.serviceWorker.ready;
        const sub = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
        });
        const result = await savePushSubscription(sub.toJSON());
        if (result.error) {
          await sub.unsubscribe();
          setMessage(result.error);
          return;
        }
        setSubscription(sub);
      } catch {
        setMessage("알림을 켜지 못했어요. 잠시 후 다시 시도해 주세요.");
      }
    });
  }

  function turnOff() {
    if (!subscription) return;
    setMessage(undefined);
    startTransition(async () => {
      await removePushSubscription(subscription.endpoint);
      await subscription.unsubscribe();
      setSubscription(null);
    });
  }

  function togglePref(key: NotificationPref) {
    const enabled = !prefs[key];
    setPrefs((current) => ({ ...current, [key]: enabled }));
    startTransition(async () => {
      const result = await updateNotificationPref(key, enabled);
      if (result.error) {
        setPrefs((current) => ({ ...current, [key]: !enabled }));
        setMessage(result.error);
      }
    });
  }

  function test() {
    setMessage(undefined);
    startTransition(async () => {
      const result = await sendTestNotification();
      setMessage(result.error ?? "테스트 알림을 보냈어요.");
    });
  }

  return (
    <section className="flex flex-col gap-3">
      <span className="text-sm font-medium">알림</span>

      <div className="flex items-center justify-between gap-3 rounded-xl bg-stone-100 px-4 py-3 dark:bg-stone-900">
        <div className="flex flex-col text-sm">
          <span className="font-medium">이 기기에서 알림 받기</span>
          <span className="text-stone-500">
            {support === "ios-needs-install"
              ? "아이폰은 홈 화면에 추가한 jjoin에서만 알림을 받을 수 있어요."
              : support === "unsupported"
                ? "이 브라우저는 알림을 지원하지 않아요."
                : subscription
                  ? "켜져 있어요"
                  : "꺼져 있어요"}
          </span>
        </div>
        {support === "supported" && (
          <button
            type="button"
            disabled={pending}
            onClick={subscription ? turnOff : turnOn}
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${
              subscription ? "bg-stone-200 dark:bg-stone-800" : "bg-brand text-white"
            }`}
          >
            {subscription ? "끄기" : "켜기"}
          </button>
        )}
      </div>

      <ul className="flex flex-col divide-y divide-stone-200 rounded-xl border border-stone-200 dark:divide-stone-800 dark:border-stone-800">
        {PREF_LABELS.map(({ key, label, hint }) => (
          <li key={key}>
            <label className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3">
              <span className="flex flex-col text-sm">
                <span className="font-medium">{label}</span>
                <span className="text-stone-500">{hint}</span>
              </span>
              <input
                type="checkbox"
                checked={prefs[key]}
                onChange={() => togglePref(key)}
                className="size-5 accent-brand"
              />
            </label>
          </li>
        ))}
      </ul>

      {subscription && (
        <button
          type="button"
          onClick={test}
          disabled={pending}
          className="self-start text-sm text-stone-500 underline underline-offset-4 disabled:opacity-50"
        >
          테스트 알림 보내기
        </button>
      )}
      {message && <p className="text-sm text-stone-600 dark:text-stone-400">{message}</p>}
    </section>
  );
}
