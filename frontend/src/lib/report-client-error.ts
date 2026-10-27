import { createClient } from "@/lib/supabase/client";

// 화면에서 생긴 문제를 client_errors 표에 남긴다. 관리자 화면(🧯 화면 오류 기록)과 1시간 요약에서 본다. (0028)
// 같은 내용은 이 탭에서 한 번만, 한 탭에서 최대 10개까지만 보낸다. (DB도 1시간 30개로 막는다)
// 로그인하지 않았으면 정책 때문에 저장되지 않는다. 기록 실패는 무시한다.
const sent = new Set<string>();
const MAX_PER_TAB = 10;

export function reportClientError(message: string, stack?: string) {
  const text = message.trim().slice(0, 500);
  if (!text || sent.has(text) || sent.size >= MAX_PER_TAB) return;
  sent.add(text);
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

// 새로 배포된 뒤 예전 화면 파일을 찾지 못하는 오류, 네트워크가 끊긴 오류처럼 새로고침으로 풀리는 문제인지
export function isRecoverableError(message: string) {
  return /ChunkLoadError|Loading (CSS )?chunk|dynamically imported module|Failed to fetch|NetworkError|Load failed|Connection closed|unexpected response was received from the server/i.test(
    message,
  );
}

// 화면 파일을 새로 받아 다시 연다. (서비스 워커는 알림용이라 지우지 않고, 혹시 남은 캐시만 비운다)
export async function reloadFresh() {
  try {
    if ("caches" in window) await Promise.all((await caches.keys()).map((key) => caches.delete(key)));
  } catch {}
  const url = new URL(location.href);
  url.searchParams.set("_r", Date.now().toString(36));
  location.replace(url.toString());
}
