import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Avatar } from "@/components/avatar";
import { BackLink } from "@/components/back-link";
import { getUserId } from "@/lib/auth";
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
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">{group.name}</h1>
        <p className="text-sm text-zinc-500">멤버 {group.members.length}명</p>
      </div>

      <InviteButton code={group.inviteCode} groupName={group.name} />

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">멤버</h2>
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

function GroupSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="h-8 w-40 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900" />
      <div className="h-12 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-900" />
      <div className="h-32 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-900" />
    </div>
  );
}
