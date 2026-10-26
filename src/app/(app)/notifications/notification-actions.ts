"use server";

import { getUserId } from "@/lib/auth";
import { sendToUser } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type BrowserSubscription = {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
};

// 이 기기의 푸시 구독을 저장한다. 구독 정보는 서버 전용 테이블이라 비밀 키로 쓴다.
export async function savePushSubscription(subscription: BrowserSubscription) {
  const userId = await getUserId();
  const { endpoint, keys } = subscription;
  if (!endpoint?.startsWith("https://") || !keys?.p256dh || !keys.auth) {
    return { error: "알림 구독 정보가 올바르지 않아요." };
  }

  const { error } = await createAdminClient()
    .from("push_subscriptions")
    .upsert({ endpoint, user_id: userId, p256dh: keys.p256dh, auth: keys.auth });
  return error ? { error: "알림을 켜지 못했어요." } : {};
}

// 이 기기의 구독을 지운다. 내 구독만 지울 수 있다.
export async function removePushSubscription(endpoint: string) {
  const userId = await getUserId();
  await createAdminClient()
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint)
    .eq("user_id", userId);
}

const PREF_COLUMNS = {
  newEvent: "notify_new_event",
  promoted: "notify_promoted",
  dayBefore: "notify_day_before",
  mention: "notify_mention",
  hourBefore: "notify_hour_before",
  comment: "notify_comment",
} as const;

export type NotificationPref = keyof typeof PREF_COLUMNS;

export async function updateNotificationPref(pref: NotificationPref, enabled: boolean) {
  const userId = await getUserId();
  const column = PREF_COLUMNS[pref];
  if (!column) return { error: "알 수 없는 알림 종류예요." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ [column]: enabled })
    .eq("id", userId);
  return error ? { error: "알림 설정을 저장하지 못했어요." } : {};
}

export async function sendTestNotification() {
  const userId = await getUserId();
  const count = await sendToUser(userId, {
    title: "jjoin 알림 테스트",
    body: "알림이 잘 도착했어요!",
    url: "/notifications",
  });
  return count > 0 ? {} : { error: "이 계정에 알림을 켠 기기가 없어요." };
}
