import { notFound } from "next/navigation";
import { Suspense } from "react";
import { updateEvent } from "@/app/(app)/events/actions";
import { EventForm } from "@/app/(app)/events/event-form";
import { BackLink } from "@/components/back-link";
import { toKstInput } from "@/lib/datetime";
import { getEvent } from "@/lib/events";
import { Page, Reveal } from "@/components/slide-view";

export default function EditEventPage({ params }: PageProps<"/events/[id]/edit">) {
  return (
    <Page className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-6">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-stone-100 dark:bg-stone-900" />}>
        {params.then(({ id }) => (
          <EditEventContent id={id} />
        ))}
      </Suspense>
    </Page>
  );
}

async function EditEventContent({ id }: { id: string }) {
  const event = await getEvent(id);
  if (!event || !event.canEdit) notFound();

  return (
    <Reveal className="flex flex-col gap-6">
      <BackLink href={`/events/${event.id}`} label={event.title} />
      <h1 className="text-2xl font-bold tracking-tight">약속 수정</h1>
      <EventForm
        action={updateEvent.bind(null, event.id)}
        initialValues={{
          title: event.title,
          startsAt: toKstInput(event.startsAt),
          placeName: event.placeName ?? "",
          placeAddress: event.place?.address ?? "",
          placeLat: event.place?.lat.toString() ?? "",
          placeLng: event.place?.lng.toString() ?? "",
          placeUrl: event.place?.url ?? "",
          maxPeople: event.maxPeople?.toString() ?? "",
          memo: event.memo ?? "",
        }}
        submitLabel="저장"
      />
    </Reveal>
  );
}
