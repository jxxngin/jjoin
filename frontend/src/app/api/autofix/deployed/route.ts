import { isAutofixRequest } from "@/lib/autofix";
import { sendToUser } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/admin";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NOTICE = "말씀해 주신 내용을 반영한 업데이트가 배포됐어요. 앱을 새로 열면 바로 확인할 수 있어요. 알려 주셔서 고마워요! 🙏";

// 운영 배포가 끝나면 GitHub 작업(.github/workflows/inquiry-deployed.yml)이 부른다. AUTOFIX_SECRET이 있어야 한다.
// 배포된 커밋에 "Inquiry: <문의 번호>"로 적힌 문의(와 같은 문의로 묶인 문의)를 처리 완료로 바꾸고,
// 대화에 배포 안내를 남기고(알림 목록에도 남는다), 문의한 사람에게 푸시를 보낸다. 문의마다 한 번만 한다. (deployed_at)
export async function POST(request: Request) {
  if (!isAutofixRequest(request)) return new Response("Unauthorized", { status: 401 });
  const body = (await request.json().catch(() => null)) as { inquiry_ids?: unknown } | null;
  const ids = Array.isArray(body?.inquiry_ids)
    ? [...new Set(body.inquiry_ids.filter((id): id is string => typeof id === "string" && UUID.test(id)))].slice(0, 50)
    : [];
  if (ids.length === 0) return Response.json({ ok: true, resolved: 0 });

  const admin = createAdminClient();
  const { data: targets, error } = await admin
    .from("inquiries")
    .select("id, title, user_id")
    .or(`id.in.(${ids.join(",")}),duplicate_of.in.(${ids.join(",")})`)
    .is("deployed_at", null);
  if (error) return new Response("Failed", { status: 500 });
  if (!targets?.length) return Response.json({ ok: true, resolved: 0 });

  const now = new Date().toISOString();
  const targetIds = targets.map((t) => t.id);
  const { error: updateError } = await admin
    .from("inquiries")
    .update({ status: "done", deployed_at: now })
    .in("id", targetIds);
  if (updateError) return new Response("Failed", { status: 500 });
  await admin
    .from("inquiry_messages")
    .insert(targetIds.map((id) => ({ inquiry_id: id, user_id: null, is_admin: true, body: NOTICE })));

  for (const target of targets) {
    if (!target.user_id) continue;
    try {
      await sendToUser(target.user_id, {
        title: "문의하신 내용이 반영됐어요",
        body: target.title,
        url: `/support/${target.id}`,
      });
    } catch (e) {
      console.error("배포 안내 푸시를 보내지 못했어요", e);
    }
  }
  return Response.json({ ok: true, resolved: targets.length });
}
