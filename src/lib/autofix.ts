import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// 오류 신고 자동 수정. 새 오류 신고가 들어오면 GitHub Actions(.github/workflows/inquiry-autofix.yml)를 깨운다.
// GitHub에는 문의 번호만 보내고, 내용은 작업이 AUTOFIX_SECRET으로 /api/autofix/inquiry/<id>에서 받아 간다.
// 작업은 수정안(PR)만 만들고, 운영 배포는 관리자가 PR을 확인하고 Merge할 때 된다.

export async function dispatchAutofix(inquiryId: string) {
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  // 토큰이 없으면(로컬 개발 등) 자동 수정을 건너뛴다.
  if (!token) return;
  const repo = process.env.GITHUB_REPOSITORY ?? "jxxngin/jjoin";

  const admin = createAdminClient();
  await admin.from("inquiries").update({ auto_fix_status: "pending" }).eq("id", inquiryId);
  const response = await fetch(`https://api.github.com/repos/${repo}/dispatches`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({ event_type: "inquiry-bug", client_payload: { inquiry_id: inquiryId } }),
  });
  if (!response.ok) {
    console.error("자동 수정 작업을 깨우지 못했어요", response.status);
    await admin.from("inquiries").update({ auto_fix_status: "failed" }).eq("id", inquiryId);
  }
}

// /api/autofix/* 요청이 GitHub 작업에서 온 것인지 확인한다.
export function isAutofixRequest(request: Request) {
  const secret = process.env.AUTOFIX_SECRET;
  return Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
}
