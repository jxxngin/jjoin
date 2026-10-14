// README 스크린샷용: 홈 화면을 가짜 데이터로 그린다.
import Image from "next/image";
import { Avatar } from "@/components/avatar";
import { Calendar } from "@/components/calendar";
import { GroupStories, type StoryGroup } from "@/components/group-stories";
import { ViewToggle } from "@/components/view-toggle";
import { Wordmark } from "@/components/wordmark";
import { GROUPS, MY_CALENDAR, TODAY } from "../mock";

// 대학 동기: 새 소식(도는 테두리) · 나머지: 다 읽음(회색)
const MY_GROUPS: StoryGroup[] = [
  { id: "demo-friends", ...GROUPS.friends, latestActivityAt: "2099-01-01T00:00:00Z" },
  { id: "demo-hiking", ...GROUPS.hiking, latestActivityAt: null },
  { id: "demo-work", ...GROUPS.work, latestActivityAt: null },
  { id: "demo-books", name: "독서 모임", emoji: "📚", color: "sky", latestActivityAt: null },
];

export default function ShowcaseHome() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Image src="/logo-512.png" alt="" width={32} height={32} className="rounded-lg" />
          <Wordmark height={26} />
        </div>
        <div className="flex items-center gap-3">
          <span className="relative flex size-8 items-center justify-center text-stone-600 dark:text-stone-300">
            <svg viewBox="0 0 24 24" aria-hidden="true" className="size-6">
              <path
                d="M6 9a6 6 0 0 1 12 0c0 4.5 1.5 6 2 7H4c.5-1 2-2.5 2-7ZM9.5 16v1a2.5 2.5 0 0 0 5 0v-1"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="absolute top-1 right-1 size-2.5 rounded-full border-2 border-background bg-brand" />
          </span>
          <Avatar src={null} color="mint" size="sm" />
        </div>
      </header>

      <GroupStories groups={MY_GROUPS} />

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">내 약속</h2>
          <ViewToggle basePath="/preview/showcase/home" mode="calendar" defaultMode="calendar" />
        </div>
        <Calendar hrefBase="/preview/showcase/home?view=calendar" range="week" anchor={TODAY} today={TODAY} items={MY_CALENDAR} />
      </section>
    </main>
  );
}
