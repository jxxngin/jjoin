import "server-only";
import { getUserId } from "@/lib/auth";
import { formatRelative } from "@/lib/datetime";
import { createClient } from "@/lib/supabase/server";

export type NotificationKind = "new_event" | "promoted" | "day_before" | "mention" | "hour_before" | "comment" | "inquiry_reply";

export type NotificationItem = {
  id: number;
  kind: NotificationKind;
  title: string;
  body: string;
  href: string;
  timeLabel: string;
  unread: boolean;
  // 댓글·언급 알림이면 그 댓글이 달린 약속과 시각. 알림 목록에서 댓글 내용을 읽으면 약속 카드의 안 읽은 댓글 배지도 끈다.
  comment: { eventId: string; at: string } | null;
};

type NotificationRow = {
  id: number;
  kind: NotificationKind;
  created_at: string;
  read_at: string | null;
  events: { id: string; title: string; groups: { name: string; emoji: string } } | null;
  event_comments: { body: string; profiles: { nickname: string } | null } | null;
  inquiries: { id: string; title: string } | null;
};

function describe(row: NotificationRow): { title: string; body: string } {
  if (row.kind === "inquiry_reply") return { title: "문의에 답변이 왔어요", body: row.inquiries?.title ?? "삭제된 문의" };
  const event = row.events;
  const eventTitle = event?.title ?? "삭제된 약속";
  if (row.kind === "new_event") {
    return { title: `${event?.groups.emoji ?? ""} ${event?.groups.name ?? ""}에 새 약속`.trim(), body: eventTitle };
  }
  if (row.kind === "promoted") return { title: "대기에서 참여로 바뀌었어요", body: eventTitle };
  if (row.kind === "day_before") return { title: "내일 약속이 있어요", body: eventTitle };
  if (row.kind === "hour_before") return { title: "1시간 뒤 약속이 있어요", body: eventTitle };
  if (row.kind === "comment") {
    const author = row.event_comments?.profiles?.nickname ?? "누군가";
    return { title: `${eventTitle}에 새 댓글`, body: `${author}: ${row.event_comments?.body ?? ""}` };
  }
  const author = row.event_comments?.profiles?.nickname ?? "누군가";
  return {
    title: `${author}님이 회원님을 언급했어요`,
    body: `${eventTitle} · ${row.event_comments?.body ?? ""}`,
  };
}

// 최근 알림 50개. 최신 순.
export async function getNotifications(): Promise<NotificationItem[]> {
  const userId = await getUserId();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("id, kind, created_at, read_at, events(id, title, groups(name, emoji)), event_comments(body, profiles(nickname)), inquiries(id, title)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50)
    .overrideTypes<NotificationRow[], { merge: false }>();

  if (error) throw new Error(`알림을 불러오지 못했어요. (${error.message})`);

  // 현재 시각이 필요하므로 렌더링이 아니라 데이터를 불러올 때 계산한다.
  const now = Date.now();
  return data.map((row) => ({
    id: row.id,
    kind: row.kind,
    ...describe(row),
    href: row.inquiries ? `/support/${row.inquiries.id}` : row.events ? `/events/${row.events.id}` : "/",
    timeLabel: formatRelative(row.created_at, now),
    unread: row.read_at === null,
    comment:
      (row.kind === "comment" || row.kind === "mention") && row.events
        ? { eventId: row.events.id, at: row.created_at }
        : null,
  }));
}

// 읽지 않은 알림 중 가장 최근 것의 id. 없으면 null. (머리글 종 아이콘의 점)
// 브라우저에서 "모두 읽음"으로 점을 끈 뒤에 새 알림이 오면 id가 바뀌어 점이 다시 켜진다.
export async function getLatestUnreadNotificationId(): Promise<number | null> {
  const userId = await getUserId();
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("id")
    .eq("user_id", userId)
    .is("read_at", null)
    .order("id", { ascending: false })
    .limit(1);
  return data?.[0]?.id ?? null;
}
