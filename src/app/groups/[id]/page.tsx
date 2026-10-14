import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { FilteredEventList } from "@/components/filtered-event-list";
import { GroupAvatar } from "@/components/group-avatar";
import { ViewToggle } from "@/components/view-toggle";
import { getUserId } from "@/lib/auth";
import { kstMonthRange, kstToday, normalizeMonth } from "@/lib/datetime";
import { getEventsBetween, getPastEvents, getUpcomingEvents } from "@/lib/events";
import { getGroup } from "@/lib/groups";
import { leaveGroup } from "../actions";
import { Calendar } from "@/components/calendar";
import { InviteButton } from "./invite-button";
import { MemberList } from "./member-list";

// month는 주소에 들어온 값 그대로다. 비었거나 잘못되면 캘린더에서 이번 달로 바꾼다.
type View ={ mode: "list" } | { mode: "calendar"; month: string | undefined };

export default function GroupPage({ params, searchParams }: PageProps<"/groups/[id]">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-6">
      <BackLink href="/" label="내 그룹" />
      <Suspense fallback={<GroupSkeleton />}>
        {Promise.all([params, searchParams]).then(([{ id }, query]) => (
          <GroupContent
            id={id}
            view={
              query.view === "calendar"
                ? {
                    mode: "calendar",
                    month: typeof query.month === "string" ? query.month : undefined,
                  }
                : { mode: "list" }
            }
          />
        ))}
      </Suspense>
    </main>
  );
}

async function GroupContent({ id, view }: { id: string; view: View }) {
  const [group, userId] = await Promise.all([getGroup(id), getUserId()]);
  if (!group) notFound();

  const isOwner = group.ownerId === userId;

  return (
    <>
      <header className="flex items-center gap-4">
        <GroupAvatar emoji={group.emoji} color={group.color} size="lg" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h1 className="truncate text-2xl font-bold tracking-tight">{group.name}</h1>
          {group.description && (
            <p className="text-sm text-stone-500">{group.description}</p>
          )}
        </div>
        {isOwner && (
          <Link
            href={`/groups/${group.id}/edit`}
            className="shrink-0 rounded-full bg-stone-100 px-3 py-1.5 text-sm font-medium dark:bg-stone-900"
          >
            꾸미기
          </Link>
        )}
      </header>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <ViewToggle basePath={`/groups/${group.id}`} mode={view.mode} />
          <Link
            href={`/groups/${group.id}/events/new`}
            className="rounded-full bg-brand px-3 py-1.5 text-sm font-medium text-white"
          >
            + 약속 만들기
          </Link>
        </div>
        <Suspense fallback={<div className="h-20 animate-pulse rounded-2xl bg-stone-100 dark:bg-stone-900" />}>
          {view.mode === "calendar" ? (
            <MonthCalendar groupId={group.id} month={view.month} />
          ) : (
            <EventList groupId={group.id} />
          )}
        </Suspense>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">멤버 {group.members.length}명</h2>
          <InviteButton code={group.inviteCode} groupName={group.name} />
        </div>

        <MemberList members={group.members} userId={userId} />
      </section>

      {!isOwner && (
        <form action={leaveGroup} className="mt-auto">
          <input type="hidden" name="groupId" value={group.id} />
          <button type="submit" className="text-sm text-stone-500 underline underline-offset-4">
            그룹 나가기
          </button>
        </form>
      )}
    </>
  );
}


async function EventList({ groupId }: { groupId: string }) {
  const [upcoming, past] = await Promise.all([
    getUpcomingEvents(groupId),
    getPastEvents(groupId),
  ]);

  // 지난 약속은 "지난 약속" 필터를 골랐을 때만 보인다.
  return (
    <FilteredEventList
      emptyText="다가오는 약속이 없어요. 새 약속을 만들어 보세요!"
      items={[...upcoming, ...past].map((event) => ({ event }))}
    />
  );
}

async function MonthCalendar({ groupId, month: rawMonth }: { groupId: string; month: string | undefined }) {
  // "이번 달"은 현재 시각이 필요하므로 요청 시점에만 계산한다.
  await connection();
  const month = normalizeMonth(rawMonth);
  const { from, to } = kstMonthRange(month);
  const events = await getEventsBetween(groupId, from, to);

  return (
    <Calendar
      key={month}
      monthHrefBase={`/groups/${groupId}?view=calendar`}
      month={month}
      today={kstToday()}
      items={events.map((event) => ({ event }))}
    />
  );
}

function GroupSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="h-8 w-40 animate-pulse rounded-lg bg-stone-100 dark:bg-stone-900" />
      <div className="h-12 animate-pulse rounded-xl bg-stone-100 dark:bg-stone-900" />
      <div className="h-32 animate-pulse rounded-xl bg-stone-100 dark:bg-stone-900" />
    </div>
  );
}
