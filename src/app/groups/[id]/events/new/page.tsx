import { notFound } from "next/navigation";
import { Suspense } from "react";
import { createEvent } from "@/app/events/actions";
import { EventForm } from "@/app/events/event-form";
import { BackLink } from "@/components/back-link";
import { getGroup } from "@/lib/groups";

const emptyValues = {
  title: "",
  startsAt: "",
  placeName: "",
  minPeople: "",
  maxPeople: "",
  memo: "",
};

export default function NewEventPage({ params }: PageProps<"/groups/[id]/events/new">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-6">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-900" />}>
        {params.then(({ id }) => (
          <NewEventContent groupId={id} />
        ))}
      </Suspense>
    </main>
  );
}

async function NewEventContent({ groupId }: { groupId: string }) {
  // 멤버가 아니면 그룹이 보이지 않는다.
  const group = await getGroup(groupId);
  if (!group) notFound();

  return (
    <>
      <BackLink href={`/groups/${group.id}`} label={group.name} />
      <h1 className="text-2xl font-bold tracking-tight">약속 만들기</h1>
      <EventForm
        action={createEvent.bind(null, group.id)}
        initialValues={emptyValues}
        submitLabel="만들기"
      />
    </>
  );
}
