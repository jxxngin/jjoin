import "server-only";
// 웹 푸시 직접 발송 (테스트 알림, 문의 답변·요약 알림).
// 알림 대기열(notification_outbox)은 Spring 워커(backend/)만 보낸다. 예전 Next의 대기열 발송(flushNotifications)은
// 나간 사람 확인·재시도가 없어 지웠다. (#27 리뷰)
import webpush from "web-push";
import { isAllowedPushEndpoint } from "@/lib/push-endpoint";
import { createAdminClient } from "@/lib/supabase/admin";

type Subscription = { endpoint: string; user_id: string; p256dh: string; auth: string };

export type PushPayload = { title: string; body: string; url: string };

let configured = false;

function configure() {
  if (configured) return;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) {
    throw new Error("VAPID 키가 설정되지 않았어요.");
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}

// 구독한 기기들에 보내고, 실제로 받은 기기 수를 돌려준다. 만료된 구독(404/410)은 지운다.
// 브라우저 푸시 서버가 아닌 주소(예전에 저장된 잘못된 구독)는 보내지 않고 만료로 보고 지운다.
async function deliver(subscriptions: Subscription[], payload: PushPayload): Promise<number> {
  configure();
  const expired: string[] = [];
  let delivered = 0;

  await Promise.all(
    subscriptions.map(async (sub) => {
      if (!isAllowedPushEndpoint(sub.endpoint)) {
        expired.push(sub.endpoint);
        return;
      }
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
          { TTL: 60 * 60 * 24 },
        );
        delivered++;
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) expired.push(sub.endpoint);
        else console.error("알림 발송 실패", status, error);
      }
    }),
  );

  if (expired.length > 0) {
    await createAdminClient().from("push_subscriptions").delete().in("endpoint", expired);
  }
  return delivered;
}

// 한 사람의 모든 기기로 바로 보내고, 실제로 받은 기기 수를 돌려준다.
// (테스트 알림, 문의 답변·요약 알림. 0이면 아무 기기도 받지 못한 것이라 부르는 쪽이 '보냄'으로 기록하지 않는다)
export async function sendToUser(userId: string, payload: PushPayload): Promise<number> {
  const { data: subscriptions } = await createAdminClient()
    .from("push_subscriptions")
    .select("endpoint, user_id, p256dh, auth")
    .eq("user_id", userId)
    .overrideTypes<Subscription[], { merge: false }>();
  if (!subscriptions || subscriptions.length === 0) return 0;
  return deliver(subscriptions, payload);
}
