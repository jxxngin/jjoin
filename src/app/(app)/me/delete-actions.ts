"use server";

import { redirect } from "next/navigation";
import { getUserId } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type DeleteAccountState = { error?: string };

// 회원 탈퇴. "탈퇴"를 직접 입력해야 진행한다.
// 1) prepare_account_deletion: 방장인 그룹·만든 약속과 투표를 넘기고, 참여 자리를 비워 대기자를 올린다 (0023)
// 2) 프로필 사진 파일을 지운다
// 3) 서버 비밀 키로 로그인 계정을 지운다 → 프로필·참여·댓글·하트·투표·알림 기록이 함께 지워진다
export async function deleteAccount(_prev: DeleteAccountState, formData: FormData): Promise<DeleteAccountState> {
  if (formData.get("confirm")?.toString().trim() !== "탈퇴") {
    return { error: "확인을 위해 '탈퇴'를 입력해 주세요." };
  }

  const userId = await getUserId();
  const supabase = await createClient();
  const { error: prepareError } = await supabase.rpc("prepare_account_deletion");
  if (prepareError) return { error: "탈퇴를 준비하지 못했어요. 잠시 뒤 다시 시도해 주세요." };

  const admin = createAdminClient();
  // 사진이 없으면 지울 것이 없을 뿐이라 결과는 보지 않는다.
  await admin.storage.from("avatars").remove([`${userId}/avatar.jpg`]);

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { error: "탈퇴하지 못했어요. 잠시 뒤 다시 시도해 주세요." };

  // 이 브라우저의 로그인 쿠키도 지운다. (계정이 이미 없어서 서버 응답은 실패해도 된다)
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login?bye=1");
}
