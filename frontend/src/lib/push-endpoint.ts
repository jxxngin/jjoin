// 웹 푸시 구독 주소(endpoint)가 실제 브라우저 푸시 서버인지.
// 서버는 이 주소로 직접 요청을 보내므로, 아무 HTTPS 주소나 받으면 서버가 원하는 곳(사설망 등)으로 요청을 보내게 할 수 있다(SSRF).
// 그래서 브라우저들이 쓰는 푸시 서버만 받는다. (Spring의 PushEndpoints와 같은 목록)
// - Chrome·Android·삼성 인터넷: fcm.googleapis.com (예전 Chrome: android.googleapis.com)
// - Firefox: updates.push.services.mozilla.com
// - Safari(iOS·macOS 홈 화면 앱): web.push.apple.com
// - Edge: *.notify.windows.com
const EXACT_HOSTS = new Set([
  "fcm.googleapis.com",
  "android.googleapis.com",
  "updates.push.services.mozilla.com",
  "web.push.apple.com",
]);
const HOST_SUFFIXES = [".notify.windows.com"];

export function isAllowedPushEndpoint(endpoint: unknown): endpoint is string {
  if (typeof endpoint !== "string" || endpoint.length > 2000) return false;
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  // https만, 사용자 정보(user:pass@)나 다른 포트는 받지 않는다.
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) return false;
  const host = url.hostname.toLowerCase();
  return EXACT_HOSTS.has(host) || HOST_SUFFIXES.some((suffix) => host.endsWith(suffix) && host.length > suffix.length);
}
