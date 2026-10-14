import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { FilteredEventList } from "@/components/filtered-event-list";
import { GroupAvatar } from "@/components/group-avatar";
import { MarkGroupSeen } from "@/components/group-stories";
import { Page, SlideView, Reveal } from "@/components/slide-view";
import { ViewToggle } from "@/components/view-toggle";
import { getUserId } from "@/lib/auth";
import { calendarRangeKeys, kstDayRange, kstToday, normalizeDateKey } from "@/lib/datetime";
import { parseCalendarQuery, type CalendarQuery } from "@/lib/calendar-query";
import { getEventsBetween, getPastEvents, getUpcomingEvents } from "@/lib/events";
import { getGroup } from "@/lib/groups";
import { getGroupPolls } from "@/lib/polls";
import { leaveGroup } from "../actions";
import { Calendar } from "@/components/calendar";
import { InviteButton } from "./invite-button";
import { MemberList } from "./member-list";

type View = { mode: "list" } | ({ mode: "calendar" } & CalendarQuery);

export default function GroupPage({ params, searchParams }: PageProps<"/groups/[id]">) {
  return (
    <Page className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-6">
      <BackLink href="/" label="내 그룹" />
      <Suspense fallback={<GroupSkeleton />}>
        {Promise.all([params, searchParams]).then(([{ id }, query]) => (
          <GroupContent
            id={id}
            view={
              query.view === "calendar"
                ? { mode: "calendar", ...parseCalendarQuery(query) }
                : { mode: "list" }
            }
          />
        ))}
      </Suspense>
    </Page>
  );
}

async function GroupContent({ id, view }: { id: string; view: View }) {
  const [group, userId] = await Promise.all([getGroup(id), getUserId()]);
  if (!group) notFound();

  const isOwner = group.ownerId === userId;

  return (
    <Reveal className="flex flex-1 flex-col gap-6">
      <MarkGroupSeen groupId={group.id} />
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
            transitionTypes={["nav-forward"]}
            className="shrink-0 rounded-full bg-stone-100 px-3 py-1.5 text-sm font-medium dark:bg-stone-900"
          >
            설정
          </Link>
        )}
      </header>

      <Suspense fallback={null}>
        <GroupPolls groupId={group.id} />
      </Suspense>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <ViewToggle basePath={`/groups/${group.id}`} mode={view.mode} />
          <Link
            href={`/groups/${group.id}/events/new`}
            transitionTypes={["nav-forward"]}
            className="rounded-full bg-brand px-3 py-1.5 text-sm font-medium text-white"
          >
            + 약속 만들기
          </Link>
        </div>
        <SlideView key={view.mode}>
          <Suspense fallback={<div className="h-20 animate-pulse rounded-2xl bg-stone-100 dark:bg-stone-900" />}>
            {view.mode === "calendar" ? (
              <GroupCalendar groupId={group.id} range={view.range} date={view.date} />
            ) : (
              <EventList groupId={group.id} />
            )}
          </Suspense>
        </SlideView>
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
    </Reveal>
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

async function GroupCalendar({ groupId, range, date }: { groupId: string } & CalendarQuery) {
  // "오늘"은 현재 시각이 필요하므로 요청 시점에만 계산한다.
  await connection();
  const anchor = normalizeDateKey(date);
  const { fromKey, toKey } = calendarRangeKeys(range, anchor);
  const { from, to } = kstDayRange(fromKey, toKey);
  const events = await getEventsBetween(groupId, from, to);

  // 주·달을 넘기면 key가 바뀌어 옆으로 넘어가는 애니메이션이 난다.
  return (
    <SlideView key={`${range}-${fromKey}`}>
      <Calendar
        hrefBase={`/groups/${groupId}?view=calendar`}
        range={range}
        anchor={anchor}
        today={kstToday()}
        items={events.map((event) => ({ event }))}
      />
    </SlideView>
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

// 아직 약속으로 확정되지 않은 날짜 투표. 없으면 아무것도 보여 주지 않는다.
async function GroupPolls({ groupId }: { groupId: string }) {
  const polls = await getGroupPolls(groupId);
  if (polls.length === 0) return null;

  return (
    <section className="reveal flex flex-col gap-2">
      <h2 className="font-semibold">🗳️ 날짜 투표</h2>
      <ul className="flex flex-col gap-2">
        {polls.map((poll) => (
          <li key={poll.id}>
            <Link
              href={`/polls/${poll.id}`}
              transitionTypes={["nav-forward"]}
              className="flex items-center gap-3 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 transition active:scale-[0.99] dark:border-violet-900 dark:bg-violet-950/40"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate font-medium">{poll.title}</span>
                <span className="text-sm text-stone-500">
                  후보 {poll.optionCount}개 · {poll.voterCount}명 참여
                </span>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                  poll.closed
                    ? "bg-stone-200 text-stone-600 dark:bg-stone-800 dark:text-stone-300"
                    : "bg-violet-200 text-violet-800 dark:bg-violet-900 dark:text-violet-200"
                }`}
              >
                {poll.closed ? "마감 · 확정 대기" : "투표 중"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
