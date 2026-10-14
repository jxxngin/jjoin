import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { getUserId } from "@/lib/auth";
import { getGroup } from "@/lib/groups";
import { EditGroupForm } from "./edit-group-form";

export default function EditGroupPage({ params }: PageProps<"/groups/[id]/edit">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-6">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-stone-100 dark:bg-stone-900" />}>
        {params.then(({ id }) => (
          <EditGroupContent id={id} />
        ))}
      </Suspense>
    </main>
  );
}

async function EditGroupContent({ id }: { id: string }) {
  const [group, userId] = await Promise.all([getGroup(id), getUserId()]);
  // 방장만 그룹 프로필을 바꿀 수 있다.
  if (!group || group.ownerId !== userId) notFound();

  return (
    <>
      <BackLink href={`/groups/${group.id}`} label={group.name} />
      <h1 className="text-2xl font-bold tracking-tight">그룹 꾸미기</h1>
      <EditGroupForm group={group} />
    </>
  );
}
