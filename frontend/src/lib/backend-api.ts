import "server-only";
import { createClient } from "@/lib/supabase/server";

// 문의를 Spring 백엔드(B3, backend/)로 처리할지. Vercel에 INQUIRY_API=spring과 BACKEND_API_URL이 있을 때만.
// 지우면 바로 지금처럼 Supabase를 직접 쓴다.
export function inquiriesOnSpring() {
  return process.env.INQUIRY_API === "spring" && !!process.env.BACKEND_API_URL;
}

// 로그인한 사용자의 Supabase 토큰을 붙여 Spring API를 부른다. (Spring이 토큰을 검증하고 그 사용자 권한(RLS)으로 처리)
export async function backendFetch(path: string, init: RequestInit = {}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("로그인이 필요해요.");
  return fetch(`${process.env.BACKEND_API_URL}${path}`, {
    ...init,
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init.headers },
  });
}

// 실패 응답의 {"error": "..."} 문장 (없으면 fallback)
export async function backendError(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? fallback;
  } catch {
    return fallback;
  }
}
