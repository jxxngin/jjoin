// 휴대폰 알림 목록(알림 센터)에 남아 있는 jjoin 알림을 닫는다. 브라우저에서만 쓴다.
// path를 주면 그 화면으로 가는 알림만, 안 주면 모두 닫는다. (public/sw.js가 data.url에 경로를 넣는다)
export async function closeSystemNotifications(path?: string) {
  try {
    const registration = await navigator.serviceWorker?.getRegistration();
    const notifications = (await registration?.getNotifications()) ?? [];
    for (const notification of notifications) {
      if (!path || notification.data?.url === path) notification.close();
    }
  } catch {
    // 알림을 지원하지 않는 브라우저에서는 할 일이 없다.
  }
}
