// README 스크린샷용: 그룹 화면을 가짜 데이터로 그린다.
import { FilteredEventList } from "@/components/filtered-event-list";
import { GroupAvatar } from "@/components/group-avatar";
import { ViewToggle } from "@/components/view-toggle";
import { InviteButton } from "@/app/(app)/groups/[id]/invite-button";
import { MemberList } from "@/app/(app)/groups/[id]/member-list";
import { GROUP_EVENTS, MEMBERS } from "../mock";

export default function ShowcaseGroup() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-6">
      <header className="flex items-center gap-4">
        <GroupAvatar emoji="🍻" color="amber" size="lg" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h1 className="truncate text-2xl font-bold tracking-tight">대학 동기</h1>
          <p className="text-sm text-stone-500">매주 금요일 한잔</p>
        </div>
        <span className="shrink-0 rounded-full bg-stone-100 px-3 py-1.5 text-sm font-medium dark:bg-stone-900">꾸미기</span>
      </header>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <ViewToggle basePath="/preview/showcase/group" mode="list" />
          <span className="rounded-full bg-brand px-3 py-1.5 text-sm font-medium text-white">+ 약속 만들기</span>
        </div>
        <FilteredEventList emptyText="" items={GROUP_EVENTS.map((event) => ({ event }))} />
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">멤버 {MEMBERS.length}명</h2>
          <InviteButton code="demo" groupName="대학 동기" />
        </div>
        <MemberList members={MEMBERS} userId="m2" />
      </section>
    </main>
  );
}
