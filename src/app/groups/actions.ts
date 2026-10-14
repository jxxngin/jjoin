"use server";

import { redirect } from "next/navigation";
import { getUserId } from "@/lib/auth";
import {
  DEFAULT_GROUP_COLOR,
  DEFAULT_GROUP_EMOJI,
  GROUP_EMOJIS,
  isGroupColor,
} from "@/lib/group-style";
import { createClient } from "@/lib/supabase/server";

export type CreateGroupState = { error?: string };
export type UpdateGroupState = { error?: string };

// 이름·이모지·색깔·소개를 검증한다. 이모지와 색깔은 정해진 선택지만 허용한다.
function readGroupProfile(formData: FormData) {
  const name = formData.get("name")?.toString().trim() ?? "";
  const emoji = formData.get("emoji")?.toString() ?? "";
  const color = formData.get("color")?.toString() ?? "";
  const description = formData.get("description")?.toString().trim() ?? "";

  if (name.length < 1 || name.length > 30) {
    return { error: "그룹 이름은 1~30자로 입력해 주세요." };
  }
  if (description.length > 60) return { error: "소개는 60자까지 쓸 수 있어요." };

  return {
    profile: {
      name,
      emoji: GROUP_EMOJIS.includes(emoji) ? emoji : DEFAULT_GROUP_EMOJI,
      color: isGroupColor(color) ? color : DEFAULT_GROUP_COLOR,
      description: description || null,
    },
  };
}

export async function createGroup(
  _prev: CreateGroupState,
  formData: FormData,
): Promise<CreateGroupState> {
  const { error: invalid, profile } = readGroupProfile(formData);
  if (!profile) return { error: invalid };

  const supabase = await createClient();
  const { data: groupId, error } = await supabase.rpc("create_group", {
    group_name: profile.name,
    group_emoji: profile.emoji,
    group_color: profile.color,
  });
  if (error || !groupId) {
    return { error: "그룹을 만들지 못했어요. 다시 시도해 주세요." };
  }

  redirect(`/groups/${groupId}`);
}

export async function updateGroup(
  groupId: string,
  _prev: UpdateGroupState,
  formData: FormData,
): Promise<UpdateGroupState> {
  const { error: invalid, profile } = readGroupProfile(formData);
  if (!profile) return { error: invalid };

  // 방장이 아니면 RLS 때문에 수정된 행이 없다.
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("groups")
    .update(profile)
    .eq("id", groupId)
    .select("id");
  if (error || data.length === 0) return { error: "그룹 정보를 저장하지 못했어요." };

  redirect(`/groups/${groupId}`);
}

export async function joinGroup(formData: FormData) {
  const code = formData.get("code")?.toString() ?? "";

  const supabase = await createClient();
  const { data: groupId, error } = await supabase.rpc("join_group", { code });
  if (error || !groupId) throw new Error("그룹에 참여하지 못했어요.");

  redirect(`/groups/${groupId}`);
}

export async function leaveGroup(formData: FormData) {
  const groupId = formData.get("groupId")?.toString() ?? "";
  const userId = await getUserId();

  // 방장은 RLS 정책상 나갈 수 없다.
  const supabase = await createClient();
  const { error } = await supabase
    .from("group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", userId);
  if (error) throw new Error("그룹에서 나가지 못했어요.");

  redirect("/");
}
