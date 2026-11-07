import Link from "next/link";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { Page } from "@/components/slide-view";
import { getNotificationPrefs } from "@/lib/auth";
import { getNotifications, getUnreadNotificationCount, type NotificationKind } from "@/lib/notifications";
import { MarkRead } from "./mark-read";
import { NotificationSettings } from "./notification-settings";
import { ReadAllButton } from "./read-all-button";
import { GhostLoading } from "@/components/ghost-loading";

const ICONS: Record<NotificationKind, string> = {
  new_event: "📅",
  promoted: "🎉",
  day_before: "⏰",
  mention: "📣",
  hour_before: "🔔",
  comment: "💬",
  inquiry_reply: "📮",
};

export default function NotificationsPage() {
  return (
    <Page className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-6">
      <BackLink href="/" label="홈" />
      <h1 className="text-2xl font-bold tracking-tight">알림</h1>
      <Suspense fallback={<div className="h-12 animate-pulse rounded-2xl bg-stone-100 dark:bg-stone-900" />}>
        <SettingsSection />
      </Suspense>
      <Suspense fallback={<GhostLoading><NotificationsSkeleton /></GhostLoading>}>
        <NotificationList />
      </Suspense>
    </Page>
  );
}

async function NotificationList() {
  // 안 읽은 수는 목록 밖 오래된 알림까지 센다. 화면을 연 뒤 보여 준 알림만 읽음이 되므로,
  // 오래된 미확인 알림이 남아 있으면 "모두 읽음" 버튼으로 정리할 수 있어야 한다. (#32 리뷰)
  const [items, unread] = await Promise.all([getNotifications(), getUnreadNotificationCount()]);

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-stone-300 px-4 py-10 text-center text-sm text-stone-500 dark:border-stone-700">
        아직 받은 알림이 없어요!
      </div>
    );
  }

  const latestId = Math.max(...items.map((item) => item.id));

  return (
    <>
      {unread > 0 && (
        <div className="-mt-3 flex items-center justify-between">
          <span className="text-sm text-stone-500">새 알림 {unread}개</span>
          <ReadAllButton latestId={latestId} unread={unread} />
        </div>
      )}
      <MarkRead
        latestId={latestId}
        shownIds={items.map((item) => item.id)}
        comments={items.flatMap((item) => (item.comment ? [item.comment] : []))}
      />
      <ul className="reveal flex flex-col gap-1">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={item.href}
              transitionTypes={["nav-forward"]}
              className={`flex gap-3 rounded-2xl px-3 py-3 transition active:scale-[0.99] ${
                item.unread ? "bg-brand/10" : ""
              }`}
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-stone-100 text-lg dark:bg-stone-900">
                {ICONS[item.kind]}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-sm font-medium">{item.title}</span>
                <span className="line-clamp-2 text-sm text-stone-500">{item.body}</span>
                <span className="text-xs text-stone-400">{item.timeLabel}</span>
              </div>
              {item.unread && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand" aria-label="새 알림" />}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

// 알림 설정: 이 기기에서 알림 받기, 종류별 켜고 끄기. 평소엔 접어 둔다.
async function SettingsSection() {
  const prefs = await getNotificationPrefs();
  return (
    <details className="group rounded-2xl border border-stone-200 dark:border-stone-800">
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
        ⚙️ 알림 설정
        <span className="text-stone-400 transition group-open:rotate-90">›</span>
      </summary>
      <div className="px-4 pb-4">
        <NotificationSettings prefs={prefs} />
      </div>
    </details>
  );
}

function NotificationsSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="h-16 animate-pulse rounded-2xl bg-stone-100 dark:bg-stone-900" />
      ))}
    </div>
  );
}
