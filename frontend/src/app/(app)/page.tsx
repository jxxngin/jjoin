import { connection } from "next/server";
import { Suspense } from "react";
import { Calendar } from "@/components/calendar";
import { EventCard } from "@/components/event-card";
import { GroupStories } from "@/components/group-stories";
import { InstallBanner } from "@/components/install-banner";
import { Page, SlideView } from "@/components/slide-view";
import { ViewToggle, type ViewMode } from "@/components/view-toggle";
import { calendarRangeKeys, kstDayRange, kstToday, normalizeDateKey } from "@/lib/datetime";
import { parseCalendarQuery, type CalendarQuery } from "@/lib/calendar-query";
import { getMyEventsBetween, getMyUpcomingEvents } from "@/lib/events";
import { getMyGroups } from "@/lib/groups";
import { GhostLoading } from "@/components/ghost-loading";

export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <Page className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-6">
      {/* 인스타 스토리처럼 그룹을 맨 위에 둔다. */}
      <Suspense fallback={<GroupRowSkeleton />}>
        <GroupList />
      </Suspense>

      <InstallBanner />

      <Suspense
        fallback={
          <section className="flex flex-col gap-3">
            <h2 className="font-semibold">내 약속</h2>
            {/* 아직 목록인지 캘린더인지 모르므로 낮게 잡는다. 캘린더로 확인되면 안쪽 로딩이 h-80을 잡는다. */}
            <GhostLoading className="h-32" />
          </section>
        }
      >
        {searchParams.then((query) => (
          <MyEventsSection
            // 내 약속은 캘린더가 기본이고, ?view=list 일 때만 목록을 보여 준다.
            mode={query.view === "list" ? "list" : "calendar"}
            calendar={parseCalendarQuery(query)}
          />
        ))}
      </Suspense>

    </Page>
  );
}

function MyEventsSection({ mode, calendar }: { mode: ViewMode; calendar: CalendarQuery }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">내 약속</h2>
        <ViewToggle basePath="/" mode={mode} defaultMode="calendar" />
      </div>
      <SlideView key={mode}>
        {/* 목록은 비어 있으면 안내 한 줄(약 86px)뿐이라, 캘린더만큼 자리를 잡으면 다 불러온 뒤 스크롤이 위로 튄다. */}
        <Suspense fallback={<GhostLoading className={mode === "calendar" ? "h-80" : "h-32"} />}>
          {mode === "calendar" ? <MyCalendar {...calendar} /> : <MyEvents />}
        </Suspense>
      </SlideView>
    </section>
  );
}

// 내가 참여·대기한 약속을 그룹 색으로 구분해 보여 준다.
async function MyCalendar({ range, date }: CalendarQuery) {
  // "오늘"은 현재 시각이 필요하므로 요청 시점에만 계산한다.
  await connection();
  const anchor = normalizeDateKey(date);
  const { fromKey, toKey } = calendarRangeKeys(range, anchor);
  const { from, to } = kstDayRange(fromKey, toKey);
  const events = await getMyEventsBetween(from, to);

  // 주·달을 넘기면 key가 바뀌어 옆으로 넘어가는 애니메이션이 난다.
  return (
    <SlideView key={`${range}-${fromKey}`}>
      <Calendar
        hrefBase="/?view=calendar"
        range={range}
        anchor={anchor}
        today={kstToday()}
        items={events.map(({ group, ...event }) => ({ event, group }))}
      />
    </SlideView>
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
    <ul className="reveal flex flex-col gap-2">
      {events.map((event) => (
        <li key={event.id}>
          <EventCard
            event={event}
            group={event.group}
            countLabel={event.myStatus === "waitlisted" ? "대기 중" : undefined}
          />
        </li>
      ))}
    </ul>
  );
}

// 그룹 아이콘 줄. 새 소식 판단은 기기에 저장된 "마지막으로 본 시각"이 필요해서 브라우저에서 한다.
async function GroupList() {
  const groups = await getMyGroups();

  return (
    <div className="reveal flex flex-col gap-2">
      <GroupStories groups={groups} />
      {groups.length === 0 && (
        <p className="text-sm text-stone-500">그룹을 만들거나 친구에게 초대 링크를 받아 보세요.</p>
      )}
    </div>
  );
}

function GroupRowSkeleton() {
  return (
    <div className="flex gap-4">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="size-[62px] animate-pulse rounded-full bg-stone-100 dark:bg-stone-900" />
      ))}
    </div>
  );
}
