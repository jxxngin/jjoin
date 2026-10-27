import { notFound } from "next/navigation";
import { Suspense } from "react";
import { createEvent } from "@/app/(app)/events/actions";
import { createPoll } from "@/app/(app)/polls/actions";
import { BackLink } from "@/components/back-link";
import { getGroup } from "@/lib/groups";
import { Page, Reveal } from "@/components/slide-view";
import { NewEventTabs } from "./new-event-tabs";

const emptyValues = {
  title: "",
  startsAt: "",
  endsOn: "",
  placeName: "",
  placeAddress: "",
  placeLat: "",
  placeLng: "",
  placeUrl: "",
  maxPeople: "",
  memo: "",
};

export default function NewEventPage({ params }: PageProps<"/groups/[id]/events/new">) {
  return (
    <Page className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-6">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-stone-100 dark:bg-stone-900" />}>
        {params.then(({ id }) => (
          <NewEventContent groupId={id} />
        ))}
      </Suspense>
    </Page>
  );
}

async function NewEventContent({ groupId }: { groupId: string }) {
  // 멤버가 아니면 그룹이 보이지 않는다.
  const group = await getGroup(groupId);
  if (!group) notFound();

  return (
    <Reveal className="flex flex-col gap-6">
      <BackLink href={`/groups/${group.id}`} label={group.name} />
      <h1 className="text-2xl font-bold tracking-tight">약속 만들기</h1>
      <NewEventTabs
        eventAction={createEvent.bind(null, group.id)}
        pollAction={createPoll.bind(null, group.id)}
        emptyValues={emptyValues}
      />
    </Reveal>
  );
}
