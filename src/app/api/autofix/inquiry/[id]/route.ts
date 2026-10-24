import { isAutofixRequest } from "@/lib/autofix";
import { createAdminClient } from "@/lib/supabase/admin";

// GitHub 자동 수정 작업이 오류 신고 내용을 받아 간다. AUTOFIX_SECRET이 있어야 한다.
// 작성자 정보는 보내지 않는다. (코드 수정에 필요 없는 개인정보)
export async function GET(request: Request, { params }: RouteContext<"/api/autofix/inquiry/[id]">) {
  if (!isAutofixRequest(request)) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });

  const { data } = await createAdminClient()
    .from("inquiries")
    .select("id, category, title, body, page_path, user_agent, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!data || data.category !== "bug") return new Response("Not found", { status: 404 });
  return Response.json(data);
}
