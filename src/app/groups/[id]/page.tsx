import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Avatar } from "@/components/avatar";
import { BackLink } from "@/components/back-link";
import { StatusBadge } from "@/components/status-badge";
import { getUserId } from "@/lib/auth";
import { formatEventDate } from "@/lib/datetime";
import { formatGoing } from "@/lib/event-status";
import { getUpcomingEvents } from "@/lib/events";
import { getGroup } from "@/lib/groups";
import { leaveGroup } from "../actions";
import { InviteButton } from "./invite-button";

export default function GroupPage({ params }: PageProps<"/groups/[id]">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-6">
      <BackLink href="/" label="내 그룹" />
      <Suspense fallback={<GroupSkeleton />}>
        {params.then(({ id }) => (
          <GroupContent id={id} />
        ))}
      </Suspense>
    </main>
  );
}

async function GroupContent({ id }: { id: string }) {
  const [group, userId] = await Promise.all([getGroup(id), getUserId()]);
  if (!group) notFound();

  const isOwner = group.ownerId === userId;

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">{group.name}</h1>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">다가오는 약속</h2>
          <Link
            href={`/groups/${group.id}/events/new`}
            className="rounded-full bg-brand px-3 py-1.5 text-sm font-medium text-white"
          >
            + 약속 만들기
          </Link>
        </div>
        <Suspense fallback={<div className="h-20 animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-900" />}>
          <UpcomingEvents groupId={group.id} />
        </Suspense>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">멤버 {group.members.length}명</h2>
        <InviteButton code={group.inviteCode} groupName={group.name} />
        <ul className="flex flex-col gap-1">
          {group.members.map((member) => (
            <li key={member.id} className="flex items-center gap-3 py-2">
              <Avatar src={member.avatarUrl} />
              <span className="font-medium">{member.nickname}</span>
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

async function UpcomingEvents({ groupId }: { groupId: string }) {
  const events = await getUpcomingEvents(groupId);

  if (events.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
        아직 약속이 없어요. 첫 약속을 만들어 보세요!
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {events.map((event) => (
        <li key={event.id}>
          <Link
            href={`/events/${event.id}`}
            className="flex flex-col gap-1 rounded-2xl bg-zinc-100 px-4 py-3 transition active:scale-[0.99] dark:bg-zinc-900"
          >
            <div className="flex items-center gap-2">
              <StatusBadge status={event.status} />
              <span className="truncate font-medium">{event.title}</span>
              <span className="ml-auto shrink-0 text-sm font-medium text-zinc-600 dark:text-zinc-400">
                {formatGoing(event.goingCount, event.maxPeople)}
              </span>
            </div>
            <span className="text-sm text-zinc-500">
              {formatEventDate(event.startsAt)}
              {event.placeName && ` · ${event.placeName}`}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
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
