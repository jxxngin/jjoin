import { NextResponse, type NextRequest } from "next/server";
import { isAppAdmin } from "@/lib/inquiries";
import { kakaoAuthorizeUrl } from "@/lib/kakao-message";

// 관리자: 카톡 알림 연결 시작. 카카오 동의 화면(talk_message)으로 보낸다.
export async function GET(request: NextRequest) {
  if (!(await isAppAdmin())) return new Response("Not found", { status: 404 });
  const state = crypto.randomUUID();
  const redirectUri = `${request.nextUrl.origin}/api/admin/kakao/callback`;
  const response = NextResponse.redirect(kakaoAuthorizeUrl(redirectUri, state));
  // 콜백에서 같은 값인지 비교해 다른 사이트가 연결을 꾸며 내지 못하게 한다.
  response.cookies.set("kakao_connect_state", state, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" });
  return response;
}
