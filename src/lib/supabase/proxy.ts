import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured, supabaseKey, supabaseUrl } from "./env";

// 요청마다 로그인 세션을 확인하고, 만료된 토큰을 갱신해 쿠키에 다시 쓴다.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  if (!isSupabaseConfigured) return response;

  const supabase = createServerClient(supabaseUrl!, supabaseKey!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        Object.entries(headers).forEach(([key, value]) =>
          response.headers.set(key, value),
        );
      },
    },
  });

  // 응답을 만들기 전에 호출해야 갱신된 토큰이 쿠키에 반영된다.
  const { data } = await supabase.auth.getClaims();

  // 로그인하지 않았으면 로그인 화면으로 보내고, 끝나면 원래 경로로 돌아온다.
  const { pathname, search } = request.nextUrl;
  if (!data?.claims && !isPublicPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }

  return response;
}

// /api/cron/은 로그인 대신 CRON_SECRET으로 직접 인증한다.
function isPublicPath(pathname: string) {
  return pathname === "/login" || pathname.startsWith("/auth/") || pathname.startsWith("/api/cron/");
}
