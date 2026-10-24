import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { LINK_PREVIEW_BOTS } from "@/lib/bots";
import { isSupabaseConfigured, supabaseKey, supabaseUrl } from "./env";

// 요청마다 로그인 세션을 확인하고, 만료된 토큰을 갱신해 쿠키에 다시 쓴다.
export async function updateSession(request: NextRequest) {
  // 링크 미리보기 크롤러는 로그인할 수 없으니 초대·약속 주소를 공유용 페이지로 바꿔 보여 준다.
  const preview = previewPath(request);
  if (preview) return NextResponse.rewrite(new URL(preview, request.url));

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
function previewPath(request: NextRequest) {
  if (!LINK_PREVIEW_BOTS.test(request.headers.get("user-agent") ?? "")) return null;
  const match = /^\/(invite|events|polls)\/([^/]+)$/.exec(request.nextUrl.pathname);
  return match ? `/share/${match[1]}/${match[2]}` : null;
}

function isPublicPath(pathname: string) {
  return (
    pathname === "/login" ||
    pathname.startsWith("/share/") ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/api/cron/") ||
    // 친구 테스트 체크리스트 (public/test.html). 로그인 전에도 연다.
    pathname === "/test.html" ||
    pathname === "/api/test-report" ||
    // 가짜 데이터로 만든 시안·README 스크린샷용 페이지. 로컬 개발에서만 로그인 없이 연다.
    (process.env.NODE_ENV === "development" && pathname.startsWith("/preview/"))
  );
}
