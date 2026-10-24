import { sendKakaoToMe } from "@/lib/kakao-message";
import { createAdminClient } from "@/lib/supabase/admin";

// 문의 1시간 요약. Supabase pg_cron이 1시간마다 이 주소를 부른다. (README의 "문의 요약 예약" 참고)
// 새 문의와 새 자동 수정 결과가 있을 때만 관리자 카톡(나와의 채팅)으로 보낸다.
// Authorization: Bearer <CRON_SECRET> 헤더가 있어야 한다.

const LABELS: Record<string, string> = { bug: "🐞 오류", feature: "💡 제안", usage: "❓ 이용", account: "👤 계정", other: "💬 기타" };

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const admin = createAdminClient();
  const [{ data: fresh }, { data: fixes }, { data: admins }] = await Promise.all([
    admin.from("inquiries").select("id, category, title").is("notified_at", null).order("created_at"),
    admin
      .from("inquiries")
      .select("id, title, auto_fix_status")
      .in("auto_fix_status", ["pr_opened", "failed"])
      .is("autofix_notified_at", null),
    admin.from("app_admins").select("user_id"),
  ]);
  const newOnes = fresh ?? [];
  const fixResults = fixes ?? [];
  if (newOnes.length === 0 && fixResults.length === 0) return Response.json({ ok: true, sent: 0 });

  const counts = new Map<string, number>();
  for (const inquiry of newOnes) counts.set(inquiry.category, (counts.get(inquiry.category) ?? 0) + 1);
  const opened = fixResults.filter((f) => f.auto_fix_status === "pr_opened").length;
  const failed = fixResults.length - opened;
  const lines = [
    newOnes.length > 0 ? `📮 jjoin 새 문의 ${newOnes.length}건` : "📮 jjoin 문의 소식",
    newOnes.length > 0 ? [...counts].map(([category, n]) => `${LABELS[category] ?? category} ${n}`).join(" · ") : null,
    opened > 0 ? `🤖 수정안 준비 ${opened}건 (확인 후 Merge)` : null,
    failed > 0 ? `⚠️ 자동 수정 실패 ${failed}건` : null,
    ...newOnes.slice(0, 3).map((inquiry) => `· ${inquiry.title}`),
  ].filter(Boolean);

  const base = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
  let sent = 0;
  for (const { user_id } of admins ?? []) {
    try {
      if (await sendKakaoToMe(user_id, { text: lines.join("\n"), url: `${base}/support/admin`, button: "문의 보기" })) sent++;
    } catch (error) {
      console.error("문의 요약 카톡을 보내지 못했어요", error);
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
