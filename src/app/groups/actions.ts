"use server";

import { redirect } from "next/navigation";
import { getUserId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type CreateGroupState = { error?: string };

export async function createGroup(
  _prev: CreateGroupState,
  formData: FormData,
): Promise<CreateGroupState> {
  const name = formData.get("name")?.toString().trim() ?? "";
  if (name.length < 1 || name.length > 30) {
    return { error: "그룹 이름은 1~30자로 입력해 주세요." };
  }

  const supabase = await createClient();
  const { data: groupId, error } = await supabase.rpc("create_group", {
    group_name: name,
  });
  if (error || !groupId) {
    return { error: "그룹을 만들지 못했어요. 다시 시도해 주세요." };
  }

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
