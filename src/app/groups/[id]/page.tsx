import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Avatar } from "@/components/avatar";
import { BackLink } from "@/components/back-link";
import { FilteredEventList } from "@/components/filtered-event-list";
import { PersonName } from "@/components/person-name";
import { getUserId } from "@/lib/auth";
import { kstMonthRange, kstToday, normalizeMonth } from "@/lib/datetime";
import { getEventsBetween, getPastEvents, getUpcomingEvents } from "@/lib/events";
import { getGroup } from "@/lib/groups";
import { leaveGroup } from "../actions";
import { Calendar } from "./calendar";
import { InviteButton } from "./invite-button";

// month는 주소에 들어온 값 그대로다. 비었거나 잘못되면 캘린더에서 이번 달로 바꾼다.
type View = { mode: "list" } | { mode: "calendar"; month: string | undefined };

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
      <h1 className="text-2xl font-bold tracking-tight">{group.name}</h1>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <ViewToggle groupId={group.id} mode={view.mode} />
          <Link
            href={`/groups/${group.id}/events/new`}
            className="rounded-full bg-brand px-3 py-1.5 text-sm font-medium text-white"
          >
            + 약속 만들기
          </Link>
        </div>
        <Suspense fallback={<div className="h-20 animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-900" />}>
          {view.mode === "calendar" ? (
            <MonthCalendar groupId={group.id} month={view.month} />
          ) : (
            <EventList groupId={group.id} />
          )}
        </Suspense>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">멤버 {group.members.length}명</h2>
        <InviteButton code={group.inviteCode} groupName={group.name} />
        <ul className="flex flex-col gap-1">
          {group.members.map((member) => (
            <li key={member.id} className="flex items-center gap-3 py-2">
              <Avatar src={member.avatarUrl} />
              <PersonName nickname={member.nickname} kakaoName={member.kakaoName} className="font-medium" />
              {member.id === userId && (
                <span className="text-sm text-zinc-500">(나)</span>
              )}
              {member.role === "owner" && (
                <span className="ml-auto rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">
                  방장
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>

      {!isOwner && (
        <form action={leaveGroup} className="mt-auto">
          <input type="hidden" name="groupId" value={group.id} />
          <button type="submit" className="text-sm text-zinc-500 underline underline-offset-4">
            그룹 나가기
          </button>
        </form>
      )}
    </>
  );
}

function ViewToggle({ groupId, mode }: { groupId: string; mode: View["mode"] }) {
  const tab = (active: boolean) =>
    `rounded-full px-3 py-1 text-sm font-medium ${
      active ? "bg-white shadow-sm dark:bg-zinc-700" : "text-zinc-500"
    }`;

  return (
    <div className="flex rounded-full bg-zinc-100 p-1 dark:bg-zinc-900">
      <Link href={`/groups/${groupId}`} className={tab(mode === "list")} replace>
        목록
      </Link>
      <Link href={`/groups/${groupId}?view=calendar`} className={tab(mode === "calendar")} replace>
        캘린더
      </Link>
    </div>
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

  return <Calendar key={month} groupId={groupId} month={month} today={kstToday()} events={events} />;
}

function GroupSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="h-8 w-40 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900" />
      <div className="h-12 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-900" />
      <div className="h-32 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-900" />
    </div>
  );
}
