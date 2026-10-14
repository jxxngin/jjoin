import "server-only";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";

export type Profile = {
  id: string;
  nickname: string;
  avatarUrl: string | null;
};

// 현재 로그인한 사용자의 프로필. 로그인하지 않았으면 로그인 화면으로 보낸다.
export async function getCurrentProfile(): Promise<Profile> {
  // Supabase가 토큰 만료 확인에 Date.now()를 쓰므로 요청 시점에만 실행한다.
  await connection();

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  if (!userId) redirect("/login");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, nickname, avatar_url")
    .eq("id", userId)
    .single();

  // 프로필은 가입 트리거가 만든다. 없다면 DB 설정(마이그레이션)이 빠진 것이다.
  if (!profile) {
    throw new Error(`프로필을 찾을 수 없어요. (${error?.code}: ${error?.message})`);
  }

  return {
    id: profile.id,
    nickname: profile.nickname,
    avatarUrl: profile.avatar_url,
  };
}
