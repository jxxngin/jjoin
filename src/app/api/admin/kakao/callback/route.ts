import { NextResponse, type NextRequest } from "next/server";
import { getUserId } from "@/lib/auth";
import { isAppAdmin } from "@/lib/inquiries";
import { connectKakao } from "@/lib/kakao-message";

// 관리자: 카카오 동의를 마치고 돌아오는 곳. 토큰을 저장하고 관리자 화면으로 보낸다.
export async function GET(request: NextRequest) {
  const back = (result: string) => {
    const response = NextResponse.redirect(new URL(`/support/admin?kakao=${result}`, request.url));
    response.cookies.delete("kakao_connect_state");
    return response;
  };
  if (!(await isAppAdmin())) return new Response("Not found", { status: 404 });

  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  if (!code || !state || state !== request.cookies.get("kakao_connect_state")?.value) return back("failed");

  try {
    await connectKakao(await getUserId(), code, `${request.nextUrl.origin}/api/admin/kakao/callback`);
    return back("connected");
  } catch (error) {
    console.error("카톡 알림 연결 실패", error);
    return back("failed");
  }
}
