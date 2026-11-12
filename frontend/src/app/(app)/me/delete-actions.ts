"use server";

import { redirect } from "next/navigation";
import { getUserId } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type DeleteAccountState = { error?: string };

// 회원 탈퇴. "탈퇴"를 직접 입력해야 진행한다.
// 1) 프로필 사진과 문의에 붙인 스크린샷 파일을 지운다 (문의 글은 작성자만 비운 채 남는다)
// 2) delete_account (0042): 방장인 그룹·만든 약속과 투표를 넘기고, 참여 자리를 비워 대기자를 올린 뒤
//    로그인 계정을 지운다 → 프로필·참여·댓글·하트·투표·알림 기록이 함께 지워진다.
//    한 트랜잭션이라 중간에 실패하면 그룹·참여 기록도 바뀌지 않는다. (사진만 먼저 지워져 있고, 다시 시도하면 이어서 된다)
export async function deleteAccount(_prev: DeleteAccountState, formData: FormData): Promise<DeleteAccountState> {
  if (formData.get("confirm")?.toString().trim() !== "탈퇴") {
    return { error: "확인을 위해 '탈퇴'를 입력해 주세요." };
  }

  const userId = await getUserId();
  const supabase = await createClient();

  const admin = createAdminClient();
  // 사진이 없으면 지울 것이 없을 뿐이라 결과는 보지 않는다.
  await admin.storage.from("avatars").remove([`${userId}/avatar.jpg`]);
  // 문의 스크린샷은 {user id}/{임의 이름}.jpg로 한 폴더에 있다. 한 번에 100개씩 지우고 빌 때까지 반복한다.
  // (지운 만큼 목록이 줄어서 항상 처음부터 다시 본다) 지우지 못하면 개인정보가 남으므로 계정을 지우지 않고 멈춘다.
  for (let round = 0; ; round++) {
    const { data: screenshots, error: listError } = await admin.storage.from("inquiry-images").list(userId, { limit: 100 });
    if (listError) return { error: "문의 사진을 지우지 못했어요. 잠시 뒤 다시 시도해 주세요." };
    if (!screenshots || screenshots.length === 0) break;
    const { error: removeError } = await admin.storage
      .from("inquiry-images")
      .remove(screenshots.map((file) => `${userId}/${file.name}`));
    // 지워지지 않는 파일이 있으면 같은 목록을 계속 보게 되므로, 넉넉한 횟수(5,000장)를 넘기면 멈춘다.
    if (removeError || round >= 50) return { error: "문의 사진을 지우지 못했어요. 잠시 뒤 다시 시도해 주세요." };
  }

  const { error } = await admin.rpc("delete_account", { p_user: userId });
  if (error) {
    console.error("탈퇴하지 못했어요", error);
    return { error: "탈퇴하지 못했어요. 잠시 뒤 다시 시도해 주세요." };
  }

  // 이 브라우저의 로그인 쿠키도 지운다. (계정이 이미 없어서 서버 응답은 실패해도 된다)
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login?bye=1");
}
