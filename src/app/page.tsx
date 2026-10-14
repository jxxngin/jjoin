import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Avatar } from "@/components/avatar";
import { Wordmark } from "@/components/wordmark";
import { Calendar } from "@/components/calendar";
import { EventCard } from "@/components/event-card";
import { GroupAvatar } from "@/components/group-avatar";
import { InstallBanner } from "@/components/install-banner";
import { ViewToggle, type ViewMode } from "@/components/view-toggle";
import { getCurrentProfile } from "@/lib/auth";
import { kstMonthRange, kstToday, normalizeMonth } from "@/lib/datetime";
import { getMyEventsBetween, getMyUpcomingEvents } from "@/lib/events";
import { getMyGroups } from "@/lib/groups";

export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Image src="/logo-512.png" alt="" width={32} height={32} className="rounded-lg" />
          <h1>
            <Wordmark height={26} priority />
          </h1>
        </div>
        <Suspense fallback={<div className="size-8" />}>
          <ProfileMenu />
        </Suspense>
      </header>

      <InstallBanner />

      <Suspense
        fallback={
          <section className="flex flex-col gap-3">
            <h2 className="font-semibold">내 약속</h2>
            <GroupListSkeleton />
          </section>
        }
      >
        {searchParams.then((query) => (
          <MyEventsSection
            mode={query.view === "calendar" ? "calendar" : "list"}
            month={typeof query.month === "string" ? query.month : undefined}
          />
        ))}
      </Suspense>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">내 그룹</h2>
          <Link
            href="/groups/new"
            className="rounded-full bg-brand px-3 py-1.5 text-sm font-medium text-white"
          >
            + 그룹 만들기
          </Link>
        </div>
        <Suspense fallback={<GroupListSkeleton />}>
          <GroupList />
        </Suspense>
      </section>
    </main>
  );
}

async function ProfileMenu() {
  const profile = await getCurrentProfile();

  return (
    <Link href="/me" aria-label="마이페이지">
      <Avatar src={profile.avatarUrl} color={profile.avatarColor} size="sm" />
    </Link>
  );
}

function MyEventsSection({ mode, month }: { mode: ViewMode; month: string | undefined }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">내 약속</h2>
        <ViewToggle basePath="/" mode={mode} />
      </div>
      <Suspense fallback={<GroupListSkeleton />}>
        {mode === "calendar" ? <MyCalendar month={month} /> : <MyEvents />}
      </Suspense>
    </section>
  );
}

// 내가 참여·대기한 약속을 그룹 색으로 구분해 보여 준다.
async function MyCalendar({ month: rawMonth }: { month: string | undefined }) {
  // "이번 달"은 현재 시각이 필요하므로 요청 시점에만 계산한다.
  await connection();
  const month = normalizeMonth(rawMonth);
  const { from, to } = kstMonthRange(month);
  const events = await getMyEventsBetween(from, to);

  return (
    <Calendar
      key={month}
      monthHrefBase="/?view=calendar"
      month={month}
      today={kstToday()}
      items={events.map(({ group, ...event }) => ({ event, group }))}
    />
  );
}

async function MyEvents() {
  const events = await getMyUpcomingEvents();

  if (events.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-stone-300 px-4 py-8 text-center text-sm text-stone-500 dark:border-stone-700">
        참여하기로 한 약속이 없어요.
      </div>
    );
  }

  // 이미 내가 참여한 약속만 모았으므로 상태 필터 없이 가까운 순으로 보여 준다.
  return (
    <ul className="flex flex-col gap-2">
      {events.map((event) => (
        <li key={event.id}>
          <EventCard
            event={event}
            groupName={event.groupName}
            countLabel={event.myStatus === "waitlisted" ? "대기 중" : undefined}
          />
        </li>
      ))}
    </ul>
  );
}

async function GroupList() {
  const groups = await getMyGroups();

  if (groups.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-stone-300 px-4 py-10 text-center text-sm text-stone-500 dark:border-stone-700">
        아직 그룹이 없어요.
        <br />
        그룹을 만들거나 친구에게 초대 링크를 받아 보세요.
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {groups.map((group) => (
        <li key={group.id}>
          <Link
            href={`/groups/${group.id}`}
            className="flex items-center gap-3 rounded-2xl bg-stone-100 p-3 pr-4 transition active:scale-[0.99] dark:bg-stone-900"
          >
            <GroupAvatar emoji={group.emoji} color={group.color} />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-medium">{group.name}</span>
              {group.description && (
                <span className="truncate text-sm text-stone-500">{group.description}</span>
              )}
            </div>
            <span className="shrink-0 text-sm text-stone-500">{group.memberCount}명</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function GroupListSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <div className="h-14 animate-pulse rounded-2xl bg-stone-100 dark:bg-stone-900" />
      <div className="h-14 animate-pulse rounded-2xl bg-stone-100 dark:bg-stone-900" />
    </div>
  );
}
