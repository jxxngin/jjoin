import "server-only";
import webpush from "web-push";
import { formatEventPeriod } from "@/lib/datetime";
import { createAdminClient } from "@/lib/supabase/admin";

type Kind = "new_event" | "promoted" | "day_before" | "mention" | "hour_before" | "comment";

type OutboxRow = {
  id: number;
  user_id: string;
  kind: Kind;
  events: {
    id: string;
    title: string;
    starts_at: string;
    ends_at: string | null;
    place_name: string | null;
    groups: { name: string };
  } | null;
  event_comments: { body: string; profiles: { nickname: string } | null } | null;
  profiles: {
    notify_new_event: boolean;
    notify_promoted: boolean;
    notify_day_before: boolean;
    notify_mention: boolean;
    notify_hour_before: boolean;
    notify_comment: boolean;
  } | null;
};

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

function wants(row: OutboxRow) {
  const prefs = row.profiles;
  if (!prefs) return false;
  if (row.kind === "new_event") return prefs.notify_new_event;
  if (row.kind === "promoted") return prefs.notify_promoted;
  if (row.kind === "mention") return prefs.notify_mention;
  if (row.kind === "hour_before") return prefs.notify_hour_before;
  if (row.kind === "comment") return prefs.notify_comment;
  return prefs.notify_day_before;
}

function payloadFor(row: OutboxRow): PushPayload | null {
  const event = row.events;
  if (!event) return null;
  const when = formatEventPeriod(event.starts_at, event.ends_at);
  const where = event.place_name ? ` · ${event.place_name}` : "";
  const url = `/events/${event.id}`;

  if (row.kind === "new_event") {
    return { title: `${event.groups.name}에 새 약속`, body: `${event.title} · ${when}`, url };
  }
  if (row.kind === "promoted") {
    return { title: "대기에서 참여로 바뀌었어요", body: `${event.title} · ${when}`, url };
  }
  if (row.kind === "mention") {
    const author = row.event_comments?.profiles?.nickname ?? "누군가";
    const body = row.event_comments?.body ?? "";
    return { title: `${author}님이 회원님을 언급했어요`, body: `${event.title} · ${body.slice(0, 80)}`, url };
  }
  if (row.kind === "comment") {
    const author = row.event_comments?.profiles?.nickname ?? "누군가";
    const body = row.event_comments?.body ?? "";
    return { title: `${event.title}에 새 댓글`, body: `${author}: ${body.slice(0, 80)}`, url };
  }
  if (row.kind === "hour_before") {
    return { title: "1시간 뒤 약속이 있어요", body: `${event.title} · ${when}${where}`, url };
  }
  return { title: "내일 약속이 있어요", body: `${event.title} · ${when}${where}`, url };
}

// 구독한 기기들에 보낸다. 만료된 구독(404/410)은 지운다.
async function deliver(subscriptions: Subscription[], payload: PushPayload) {
  configure();
  const expired: string[] = [];

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
          { TTL: 60 * 60 * 24 },
        );
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
}

// 쌓인 알림을 보낸다. 서버 액션의 after()와 Cron에서 부른다.
export async function flushNotifications() {
  const admin = createAdminClient();

  const { data: pending } = await admin
    .from("notification_outbox")
    .select("id")
    .order("id")
    .limit(500);
  if (!pending || pending.length === 0) return;

  // 동시에 두 번 불려도 같은 알림을 두 번 보내지 않도록, 지우는 데 성공한 행만 보낸다.
  const { data: claimed } = await admin
    .from("notification_outbox")
    .delete()
    .in(
      "id",
      pending.map((row) => row.id),
    )
    .select(
      "id, user_id, kind, events(id, title, starts_at, ends_at, place_name, groups(name)), event_comments(body, profiles(nickname)), profiles(notify_new_event, notify_promoted, notify_day_before, notify_mention, notify_hour_before, notify_comment)",
    )
    .overrideTypes<OutboxRow[], { merge: false }>();
  if (!claimed || claimed.length === 0) return;

  const rows = claimed.filter(wants);
  const userIds = [...new Set(rows.map((row) => row.user_id))];
  if (userIds.length === 0) return;

  const { data: subscriptions } = await admin
    .from("push_subscriptions")
    .select("endpoint, user_id, p256dh, auth")
    .in("user_id", userIds)
    .overrideTypes<Subscription[], { merge: false }>();
  if (!subscriptions || subscriptions.length === 0) return;

  await Promise.all(
    rows.map((row) => {
      const payload = payloadFor(row);
      const targets = subscriptions.filter((sub) => sub.user_id === row.user_id);
      return payload && targets.length > 0 ? deliver(targets, payload) : undefined;
    }),
  );
}

// 마이페이지의 "테스트 알림" 용
export async function sendToUser(userId: string, payload: PushPayload) {
  const { data: subscriptions } = await createAdminClient()
    .from("push_subscriptions")
    .select("endpoint, user_id, p256dh, auth")
    .eq("user_id", userId)
    .overrideTypes<Subscription[], { merge: false }>();
  if (!subscriptions || subscriptions.length === 0) return 0;
  await deliver(subscriptions, payload);
  return subscriptions.length;
}
