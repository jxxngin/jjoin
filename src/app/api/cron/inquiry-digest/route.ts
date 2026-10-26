import { sendToUser } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/admin";

// 문의 1시간 요약. Supabase pg_cron이 1시간마다 이 주소를 부른다. (README의 "문의 요약 예약" 참고)
// 새 문의와 새 자동 수정 결과, 지난 1시간의 화면 오류가 있을 때만 관리자 휴대폰에 jjoin 푸시 알림으로 보낸다.
// (관리자가 마이페이지에서 "이 기기에서 알림 받기"를 켜 둔 기기로 간다. 오류 신고는 들어올 때 바로 보내서 여기선 빠진다)
// 함께 오래된 기록을 지운다: 처리 완료 90일 지난 문의의 기기 정보, 30일 지난 화면 오류.
// Authorization: Bearer <CRON_SECRET> 헤더가 있어야 한다.

const LABELS: Record<string, string> = { bug: "🐞 오류", feature: "💡 제안", usage: "❓ 이용", account: "👤 계정", other: "💬 기타" };

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const admin = createAdminClient();
  await Promise.all([
    admin
      .from("inquiries")
      .update({ user_agent: null })
      .eq("status", "done")
      .lt("done_at", new Date(Date.now() - 90 * 864e5).toISOString())
      .not("user_agent", "is", null),
    admin.from("client_errors").delete().lt("created_at", new Date(Date.now() - 30 * 864e5).toISOString()),
  ]);

  const [{ data: fresh }, { data: fixes }, { data: admins }, { count: errorCount }] = await Promise.all([
    admin.from("inquiries").select("id, category, title").is("notified_at", null).order("created_at"),
    admin
      .from("inquiries")
      .select("id, title, auto_fix_status")
      .in("auto_fix_status", ["pr_opened", "failed"])
      .is("autofix_notified_at", null),
    admin.from("app_admins").select("user_id"),
    admin
      .from("client_errors")
      .select("id", { count: "exact", head: true })
      .gt("created_at", new Date(Date.now() - 3600e3).toISOString()),
  ]);
  const newOnes = fresh ?? [];
  const fixResults = fixes ?? [];
  const errors = errorCount ?? 0;
  if (newOnes.length === 0 && fixResults.length === 0 && errors === 0) return Response.json({ ok: true, sent: 0 });

  const counts = new Map<string, number>();
  for (const inquiry of newOnes) counts.set(inquiry.category, (counts.get(inquiry.category) ?? 0) + 1);
  const opened = fixResults.filter((f) => f.auto_fix_status === "pr_opened").length;
  const failed = fixResults.length - opened;
  const lines = [
    newOnes.length > 0 ? `📮 jjoin 새 문의 ${newOnes.length}건` : "📮 jjoin 문의 소식",
    newOnes.length > 0 ? [...counts].map(([category, n]) => `${LABELS[category] ?? category} ${n}`).join(" · ") : null,
    opened > 0 ? `🤖 수정안 준비 ${opened}건 (확인 후 Merge)` : null,
    failed > 0 ? `⚠️ 자동 수정 실패 ${failed}건` : null,
    errors > 0 ? `🧯 화면 오류 ${errors}건` : null,
    ...newOnes.slice(0, 3).map((inquiry) => `· ${inquiry.title}`),
  ].filter(Boolean);

  let sent = 0;
  for (const { user_id } of admins ?? []) {
    try {
      // 첫 줄은 제목, 나머지는 본문 (휴대폰 알림에 들어가게 짧게)
      const delivered = await sendToUser(user_id, {
        title: lines[0] ?? "📮 jjoin 문의",
        body: lines.slice(1).join(" · ").slice(0, 140) || "관리자 화면에서 확인해 주세요.",
        url: "/support/admin",
      });
      if (delivered > 0) sent++;
    } catch (error) {
      console.error("문의 요약 푸시를 보내지 못했어요", error);
    }
  }
  // 아무에게도 못 보냈으면 표시하지 않고 다음 시간에 다시 보낸다.
  if (sent > 0) {
    const now = new Date().toISOString();
    if (newOnes.length > 0) await admin.from("inquiries").update({ notified_at: now }).in("id", newOnes.map((i) => i.id));
    if (fixResults.length > 0) await admin.from("inquiries").update({ autofix_notified_at: now }).in("id", fixResults.map((i) => i.id));
  }
  return Response.json({ ok: true, sent, inquiries: newOnes.length, fixes: fixResults.length });
}
