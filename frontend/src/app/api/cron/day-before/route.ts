import { flushNotifications } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/admin";

// 하루 전 알림. Vercel Cron이 매일 한국 시간 오전 10시에 부른다. (vercel.json)
// Vercel은 Authorization: Bearer <CRON_SECRET> 헤더를 붙여 보낸다.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  // Java Spring 워커(backend/)가 예약 작업을 맡으면 CRON_WORKER=spring으로 두고 여기서는 쉰다. (PLAN.md §10 B2)
  if (process.env.CRON_WORKER === "spring") return Response.json({ ok: true, skipped: "spring" });

  const { data: queued, error } = await createAdminClient().rpc("queue_day_before_notifications");
  if (error) {
    console.error("하루 전 알림을 준비하지 못했어요", error);
    return Response.json({ ok: false }, { status: 500 });
  }

  // 대기열에 남아 있던 다른 알림도 함께 보낸다.
  await flushNotifications();
  return Response.json({ ok: true, queued });
}
