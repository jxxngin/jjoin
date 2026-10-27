import { flushNotifications } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/admin";

// 1시간 전 알림. Vercel 무료 플랜의 Cron은 하루 한 번뿐이라,
// Supabase pg_cron이 10분마다 이 주소를 부른다. (README의 "1시간 전 알림 예약" 참고)
// Authorization: Bearer <CRON_SECRET> 헤더가 있어야 한다.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  // Java Spring 워커(backend/)가 예약 작업을 맡으면 CRON_WORKER=spring으로 두고 여기서는 쉰다. (PLAN.md §10 B2)
  if (process.env.CRON_WORKER === "spring") return Response.json({ ok: true, skipped: "spring" });

  const { data: queued, error } = await createAdminClient().rpc("queue_hour_before_notifications");
  if (error) {
    console.error("1시간 전 알림을 준비하지 못했어요", error);
    return Response.json({ ok: false }, { status: 500 });
  }

  await flushNotifications();
  return Response.json({ ok: true, queued });
}
