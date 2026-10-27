import { isAutofixRequest } from "@/lib/autofix";
import { createAdminClient } from "@/lib/supabase/admin";

const STATUSES = new Set(["pr_opened", "failed", "skipped"]);

// GitHub 자동 수정 작업이 결과를 알린다: 수정안(PR) 주소, 실패, 대상 아님. AUTOFIX_SECRET이 있어야 한다.
export async function POST(request: Request) {
  if (!isAutofixRequest(request)) return new Response("Unauthorized", { status: 401 });
  const body = (await request.json().catch(() => null)) as { inquiry_id?: string; status?: string; url?: string } | null;
  if (!body?.inquiry_id || !/^[0-9a-f-]{36}$/i.test(body.inquiry_id) || !STATUSES.has(body.status ?? "")) {
    return new Response("Bad request", { status: 400 });
  }
  const url = body.url && /^https:\/\/github\.com\//.test(body.url) ? body.url.slice(0, 300) : null;

  const { error } = await createAdminClient()
    .from("inquiries")
    .update({ auto_fix_status: body.status, auto_fix_url: url })
    .eq("id", body.inquiry_id);
  if (error) return new Response("Failed", { status: 500 });
  return Response.json({ ok: true });
}
