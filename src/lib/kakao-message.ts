import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// 카카오톡 "나에게 보내기". 관리자 본인의 카톡(나와의 채팅)으로 문의 요약을 보낸다.
// 관리자가 한 번 카카오로 연결하면(talk_message 동의) 토큰을 저장해 두고, 만료 전에 알아서 갱신한다.
// https://developers.kakao.com/docs/latest/ko/message/rest-api#default-template-msg-me

const AUTH_URL = "https://kauth.kakao.com/oauth";
const SEND_URL = "https://kapi.kakao.com/v2/api/talk/memo/default/send";

type TokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  error?: string;
};

function clientParams() {
  const key = process.env.KAKAO_REST_API_KEY;
  if (!key) throw new Error("KAKAO_REST_API_KEY가 설정되지 않았어요.");
  const params: Record<string, string> = { client_id: key };
  if (process.env.KAKAO_CLIENT_SECRET) params.client_secret = process.env.KAKAO_CLIENT_SECRET;
  return params;
}

// 카카오 연결 화면 주소. state는 위조 방지용으로 쿠키에도 넣어 콜백에서 비교한다.
export function kakaoAuthorizeUrl(redirectUri: string, state: string) {
  const params = new URLSearchParams({
    client_id: clientParams().client_id,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "talk_message",
    state,
  });
  return `${AUTH_URL}/authorize?${params}`;
}

async function requestToken(body: Record<string, string>): Promise<TokenResponse> {
  const response = await fetch(`${AUTH_URL}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
    body: new URLSearchParams({ ...clientParams(), ...body }),
  });
  const data = (await response.json()) as TokenResponse;
  if (!response.ok || data.error) throw new Error("카카오 토큰을 받지 못했어요.");
  return data;
}

async function saveTokens(userId: string, data: TokenResponse, previousRefresh?: string) {
  const now = Date.now();
  await createAdminClient()
    .from("admin_kakao_tokens")
    .upsert({
      user_id: userId,
      access_token: data.access_token,
      // 갱신할 때 새 refresh_token은 만료가 가까울 때만 온다. 없으면 쓰던 것을 계속 쓴다.
      refresh_token: data.refresh_token ?? previousRefresh ?? "",
      access_expires_at: new Date(now + data.expires_in * 1000).toISOString(),
      ...(data.refresh_token_expires_in
        ? { refresh_expires_at: new Date(now + data.refresh_token_expires_in * 1000).toISOString() }
        : {}),
      updated_at: new Date(now).toISOString(),
    });
}

// 연결 콜백: 받은 code로 토큰을 받아 저장한다.
export async function connectKakao(userId: string, code: string, redirectUri: string) {
  const data = await requestToken({ grant_type: "authorization_code", code, redirect_uri: redirectUri });
  await saveTokens(userId, data);
}

// 연결 상태 (관리자 화면 표시용)
export async function getKakaoConnection(userId: string) {
  const { data } = await createAdminClient()
    .from("admin_kakao_tokens")
    .select("refresh_expires_at, updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  return data as { refresh_expires_at: string | null; updated_at: string } | null;
}

// 쓸 수 있는 access token. 5분 안에 만료되면 먼저 갱신한다.
async function accessTokenFor(userId: string) {
  const { data } = await createAdminClient()
    .from("admin_kakao_tokens")
    .select("access_token, refresh_token, access_expires_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return null;
  const row = data as { access_token: string; refresh_token: string; access_expires_at: string };
  if (Date.parse(row.access_expires_at) - Date.now() > 5 * 60 * 1000) return row.access_token;
  const refreshed = await requestToken({ grant_type: "refresh_token", refresh_token: row.refresh_token });
  await saveTokens(userId, refreshed, row.refresh_token);
  return refreshed.access_token;
}

// 관리자 카톡으로 글을 보낸다. text는 카카오 제한(200자)에 맞춰 자른다. 연결이 없으면 false.
export async function sendKakaoToMe(userId: string, { text, url, button }: { text: string; url: string; button: string }) {
  const token = await accessTokenFor(userId);
  if (!token) return false;
  const template = {
    object_type: "text",
    text: text.length > 200 ? `${text.slice(0, 197)}…` : text,
    link: { web_url: url, mobile_web_url: url },
    button_title: button,
  };
  const response = await fetch(SEND_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
    },
    body: new URLSearchParams({ template_object: JSON.stringify(template) }),
  });
  if (!response.ok) throw new Error("카카오톡 메시지를 보내지 못했어요.");
  return true;
}
