"use server";

import { refresh } from "next/cache";
import { getUserId } from "@/lib/auth";
import { isAvatarColor } from "@/lib/avatar-style";
import { createClient } from "@/lib/supabase/server";

export type ProfileFormState = { error?: string; saved?: boolean };

// avatarMode: keep(그대로) | remove(기본 이미지) | upload(avatar 파일로 교체)
export async function updateProfile(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const nickname = formData.get("nickname")?.toString().trim() ?? "";
  const avatarMode = formData.get("avatarMode")?.toString();
  const avatar = formData.get("avatar");

  if (nickname.length < 1 || nickname.length > 20) {
    return { error: "닉네임은 1~20자로 입력해 주세요." };
  }

  const userId = await getUserId();
  const supabase = await createClient();
  const avatarColor = formData.get("avatarColor")?.toString() ?? "";
  const changes: { nickname: string; avatar_url?: string | null; avatar_color?: string } = {
    nickname,
  };
  if (isAvatarColor(avatarColor)) changes.avatar_color = avatarColor;

  if (avatarMode === "remove") {
    changes.avatar_url = null;
  } else if (avatarMode === "upload") {
    if (!(avatar instanceof File) || avatar.size === 0) {
      return { error: "사진을 다시 골라 주세요." };
    }

    // 파일 이름은 고정하고, 주소 뒤에 버전을 붙여 브라우저 캐시를 피한다.
    const path = `${userId}/avatar.jpg`;
    const { error } = await supabase.storage
      .from("avatars")
      .upload(path, avatar, { upsert: true, contentType: "image/jpeg" });
    if (error) return { error: "사진을 올리지 못했어요. 다시 시도해 주세요." };

    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    changes.avatar_url = `${data.publicUrl}?v=${Date.now()}`;
  }

  const { error } = await supabase.from("profiles").update(changes).eq("id", userId);
  if (error) return { error: "프로필을 저장하지 못했어요." };

  refresh();
  return { saved: true };
}
