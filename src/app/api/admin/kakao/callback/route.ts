import { NextResponse, type NextRequest } from "next/server";
import { getUserId } from "@/lib/auth";
import { isAppAdmin } from "@/lib/inquiries";
import { KakaoTokenError, connectKakao } from "@/lib/kakao-message";

// 관리자: 카카오 동의를 마치고 돌아오는 곳. 토큰을 저장하고 관리자 화면으로 보낸다.
export async function GET(request: NextRequest) {
  // reason: 실패 원인 (카카오 오류 코드 KOE…, 또는 state·denied) — 관리자 화면에 보여 준다.
  const back = (result: string, reason?: string) => {
    const query = new URLSearchParams({ kakao: result, ...(reason ? { reason } : {}) });
    const response = NextResponse.redirect(new URL(`/support/admin?${query}`, request.url));
    response.cookies.delete("kakao_connect_state");
    return response;
  };
  if (!(await isAppAdmin())) return new Response("Not found", { status: 404 });

  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  // 동의 화면에서 취소하면 code 대신 error가 온다.
  if (!code) return back("failed", searchParams.get("error") ?? "no_code");
  if (!state || state !== request.cookies.get("kakao_connect_state")?.value) return back("failed", "state");

  try {
    await connectKakao(await getUserId(), code, `${request.nextUrl.origin}/api/admin/kakao/callback`);
    return back("connected");
  } catch (error) {
    console.error("카톡 알림 연결 실패", error);
    return back("failed", error instanceof KakaoTokenError ? error.code : "save");
  }
}
