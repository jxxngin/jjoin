import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { StatusBadge } from "@/components/status-badge";
import { formatDaysLeft, formatEventDate } from "@/lib/datetime";
import { formatGoing } from "@/lib/event-status";
import type { EventSummary } from "@/lib/events";

// 파스텔 무지개. 먼 약속은 보라, 가까울수록 파랑→초록→노랑→주황→빨강으로 따뜻해진다.
// 종료된 약속(null)은 회색.
function urgency(days: number | null) {
  if (days === null) return { bar: "bg-stone-300 dark:bg-stone-700", text: "text-stone-500", pill: "bg-stone-500/10 text-stone-500" };
  if (days === 0) return { bar: "bg-rose-400", text: "text-rose-600 dark:text-rose-300", pill: "bg-rose-400/35 text-rose-600 dark:text-rose-300" };
  if (days === 1) return { bar: "bg-orange-400", text: "text-orange-600 dark:text-orange-300", pill: "bg-orange-400/30 text-orange-600 dark:text-orange-300" };
  if (days <= 3) return { bar: "bg-yellow-400", text: "text-yellow-700 dark:text-yellow-300", pill: "bg-yellow-400/30 text-yellow-700 dark:text-yellow-300" };
  if (days <= 5) return { bar: "bg-emerald-400", text: "text-emerald-700 dark:text-emerald-300", pill: "bg-emerald-400/25 text-emerald-700 dark:text-emerald-300" };
  if (days <= 7) return { bar: "bg-sky-400", text: "text-sky-700 dark:text-sky-300", pill: "bg-sky-400/25 text-sky-700 dark:text-sky-300" };
  return { bar: "bg-violet-400", text: "text-violet-600 dark:text-violet-300", pill: "bg-violet-400/20 text-violet-600 dark:text-violet-300" };
}

// 약속 상세 화면용 배지. "오늘", "내일", "3일 후"
export function DaysLeftBadge({ days }: { days: number }) {
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${urgency(days).pill}`}>
      {formatDaysLeft(days)}
    </span>
  );
}

// 약속 목록 한 줄. 왼쪽 무지개 띠로 얼마나 가까운지 보여 주고,
// 둘째 줄 맨 앞에 "3일 후"처럼 남은 날을 적는다.
export function EventCard({
  event,
  group,
  countLabel,
}: {
  event: EventSummary;
  // 여러 그룹의 약속을 섞어 보여 줄 때(홈) 카드 맨 위에 그룹을 작게 붙인다.
  group?: { name: string; emoji: string };
  countLabel?: string;
}) {
  const days = event.status === "ended" ? null : event.daysLeft;
  const colors = urgency(days);
  // 그룹 줄이 있으면 무거워 보이지 않게 장소는 빼고 날짜만 남긴다.
  const details = group
    ? formatEventDate(event.startsAt)
    : [formatEventDate(event.startsAt), event.placeName].filter(Boolean).join(" · ");

  return (
    <Link
      href={`/events/${event.id}`}
      className="relative flex flex-col gap-1 overflow-hidden rounded-2xl bg-stone-100 py-3 pr-4 pl-5 transition active:scale-[0.99] dark:bg-stone-900"
    >
      <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1.5 ${colors.bar}`} />
      {group && (
        <span className="truncate text-xs font-medium text-stone-500">
          {group.emoji} {group.name}
        </span>
      )}
      <div className="flex items-center gap-2">
        <span className="truncate font-medium">{event.title}</span>
        <StatusBadge status={event.status} />
        <span className="ml-auto flex shrink-0 items-center gap-1.5 text-sm font-medium text-stone-600 dark:text-stone-400">
          {countLabel ?? formatGoing(event.goingCount, event.maxPeople)}
          {event.creator && (
            <span title={`${event.creator.nickname}님이 만든 약속`}>
              <Avatar src={event.creator.avatarUrl} color={event.creator.avatarColor} size="xs" />
            </span>
          )}
        </span>
      </div>
      <span className="truncate text-sm text-stone-500">
        {days !== null && <b className={`mr-1 ${colors.text}`}>{formatDaysLeft(days)}</b>}
        {details}
      </span>
    </Link>
  );
}
