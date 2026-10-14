import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { getUserId } from "@/lib/auth";
import { getGroup } from "@/lib/groups";
import { EditGroupForm } from "./edit-group-form";
import { GroupAdmin } from "./group-admin";
import { Page, Reveal } from "@/components/slide-view";

export default function EditGroupPage({ params }: PageProps<"/groups/[id]/edit">) {
  return (
    <Page className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-6">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-stone-100 dark:bg-stone-900" />}>
        {params.then(({ id }) => (
          <EditGroupContent id={id} />
        ))}
      </Suspense>
    </Page>
  );
}

async function EditGroupContent({ id }: { id: string }) {
  const [group, userId] = await Promise.all([getGroup(id), getUserId()]);
  // 방장만 그룹 프로필을 바꾸고 멤버를 관리할 수 있다.
  if (!group || group.ownerId !== userId) notFound();

  return (
    <Reveal className="flex flex-col gap-6">
      <BackLink href={`/groups/${group.id}`} label={group.name} />
      <h1 className="text-2xl font-bold tracking-tight">그룹 설정</h1>
      <EditGroupForm group={group} />
      <hr className="border-stone-200 dark:border-stone-800" />
      <GroupAdmin groupId={group.id} groupName={group.name} members={group.members} ownerId={group.ownerId} />
    </Reveal>
  );
}
