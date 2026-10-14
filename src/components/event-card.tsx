import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { StatusBadge } from "@/components/status-badge";
import { formatEventDate } from "@/lib/datetime";
import { formatGoing } from "@/lib/event-status";
import type { EventSummary } from "@/lib/events";

// 파스텔 무지개. 먼 약속은 보라, 가까울수록 파랑→초록→노랑→주황→빨강으로 따뜻해진다.
function ddayColors(dday: string) {
  const days = dday === "D-Day" ? 0 : Number(dday.slice(2));
  if (days === 0) return "bg-rose-400/35 text-rose-600 dark:text-rose-300";
  if (days === 1) return "bg-orange-400/30 text-orange-600 dark:text-orange-300";
  if (days <= 3) return "bg-yellow-400/30 text-yellow-700 dark:text-yellow-300";
  if (days <= 5) return "bg-emerald-400/25 text-emerald-700 dark:text-emerald-300";
  if (days <= 7) return "bg-sky-400/25 text-sky-700 dark:text-sky-300";
  return "bg-violet-400/20 text-violet-600 dark:text-violet-300";
}

export function Dday({ value }: { value: string }) {
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${ddayColors(value)}`}>
      {value}
    </span>
  );
}

// 약속 목록 한 줄. 상태·제목·디데이·인원 + 날짜·장소.
export function EventCard({
  event,
  groupName,
  countLabel,
}: {
  event: EventSummary;
  // 여러 그룹의 약속을 섞어 보여 줄 때 그룹 이름을 앞에 붙인다.
  groupName?: string;
  countLabel?: string;
}) {
  const details = [groupName, formatEventDate(event.startsAt), event.placeName].filter(Boolean);

  return (
    <Link
      href={`/events/${event.id}`}
      className="flex flex-col gap-1 rounded-2xl bg-stone-100 px-4 py-3 transition active:scale-[0.99] dark:bg-stone-900"
    >
      <div className="flex items-center gap-2">
        {event.dday && event.status !== "ended" && <Dday value={event.dday} />}
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
      <span className="truncate text-sm text-stone-500">{details.join(" · ")}</span>
    </Link>
  );
}
