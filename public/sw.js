// jjoin 서비스 워커.
// 오프라인 캐시는 하지 않는다. 로그인한 화면이 오래된 상태로 보이는 문제를 피하기 위해서다.
// 설치(PWA)와 알림(10단계)에 필요한 것만 둔다.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// 서버가 보낸 알림을 띄운다. data: { title, body, url }
self.addEventListener("push", (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: data.url || "/" },
    }),
  );
});

// 알림을 누르면 이미 열린 앱 창이 있으면 그 창에서, 없으면 새로 연다.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const existing = windows.find((w) => new URL(w.url).origin === self.location.origin);
      if (existing) return existing.navigate(url).then((w) => w?.focus());
      return self.clients.openWindow(url);
    }),
  );
});
