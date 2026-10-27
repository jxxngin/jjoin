import { createAdminClient } from "@/lib/supabase/admin";

// 친구 테스트 체크리스트(public/test.html)가 고를 때마다 결과를 보낸다.
// 로그인 없이 부르는 주소라 크기와 모양을 꼼꼼히 확인하고, 기기 아이디로 덮어쓴다.
const MAX_BODY = 20_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALUES = new Set(["ok", "bad", "skip"]);

const text = (value: unknown, max: number) =>
  typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;

export async function POST(request: Request) {
  const raw = await request.text();
  if (raw.length > MAX_BODY) return Response.json({ ok: false }, { status: 413 });

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw);
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
  if (typeof body.id !== "string" || !UUID.test(body.id)) {
    return Response.json({ ok: false }, { status: 400 });
  }

  // 항목 이름 → { v, memo }. 정해진 값만 남긴다.
  const answers: Record<string, { v: string; memo?: string }> = {};
  if (body.answers && typeof body.answers === "object") {
    for (const [key, entry] of Object.entries(body.answers).slice(0, 60)) {
      const { v, memo } = (entry ?? {}) as { v?: unknown; memo?: unknown };
      if (typeof v !== "string" || !VALUES.has(v)) continue;
      answers[key.slice(0, 120)] = { v, ...(text(memo, 1000) ? { memo: text(memo, 1000)! } : {}) };
    }
  }

  const { error } = await createAdminClient()
    .from("test_reports")
    .upsert({
      id: body.id,
      name: text(body.name, 40),
      device: text(body.device, 20),
      browser: text(body.browser, 20),
      answers,
      memo: text(body.memo, 3000),
      updated_at: new Date().toISOString(),
    });

  if (error) {
    console.error("테스트 결과를 저장하지 못했어요", error);
    return Response.json({ ok: false }, { status: 500 });
  }
  return Response.json({ ok: true });
}
