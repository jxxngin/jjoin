import "server-only";
import type { AvatarColor } from "@/lib/avatar-style";
import { redirect } from "next/navigation";
import { getVisibleKakaoNames } from "@/lib/kakao-names";
import { createClient } from "@/lib/supabase/server";

export type Profile = {
  id: string;
  nickname: string;
  kakaoName: string | null;
  avatarUrl: string | null;
  avatarColor: AvatarColor;
};

// 현재 로그인한 사용자 id. 로그인하지 않았으면 로그인 화면으로 보낸다.
export async function getUserId() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (!userId) redirect("/login");
  return userId;
}

export type NotificationPrefs = { newEvent: boolean; promoted: boolean; dayBefore: boolean; mention: boolean; hourBefore: boolean; comment: boolean };

// 종류별 알림 받기 설정 (알림 화면의 알림 설정)
export async function getNotificationPrefs(): Promise<NotificationPrefs> {
  const userId = await getUserId();
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("notify_new_event, notify_promoted, notify_day_before, notify_mention, notify_hour_before, notify_comment")
    .eq("id", userId)
    .single();

  return {
    newEvent: data?.notify_new_event ?? true,
    promoted: data?.notify_promoted ?? true,
    dayBefore: data?.notify_day_before ?? true,
    mention: data?.notify_mention ?? true,
    hourBefore: data?.notify_hour_before ?? true,
    comment: data?.notify_comment ?? true,
  };
}

// 현재 로그인한 사용자의 프로필.
export async function getCurrentProfile(): Promise<Profile> {
  const userId = await getUserId();
  const supabase = await createClient();

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, nickname, avatar_url, avatar_color")
    .eq("id", userId)
    .single();

  // 프로필은 가입 트리거가 만든다. 없다면 DB 설정(마이그레이션)이 빠진 것이다.
  if (!profile) {
    throw new Error(`프로필을 찾을 수 없어요. (${error?.code}: ${error?.message})`);
  }

  return {
    id: profile.id,
    nickname: profile.nickname,
    kakaoName: (await getVisibleKakaoNames()).get(userId) ?? null,
    avatarUrl: profile.avatar_url,
    avatarColor: profile.avatar_color,
  };
}
