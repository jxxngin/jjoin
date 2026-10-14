import { notFound } from "next/navigation";
import { Suspense } from "react";
import { updateEvent } from "@/app/events/actions";
import { EventForm } from "@/app/events/event-form";
import { BackLink } from "@/components/back-link";
import { toKstInput } from "@/lib/datetime";
import { getEvent } from "@/lib/events";

export default function EditEventPage({ params }: PageProps<"/events/[id]/edit">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-6">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-900" />}>
        {params.then(({ id }) => (
          <EditEventContent id={id} />
        ))}
      </Suspense>
    </main>
  );
}

async function EditEventContent({ id }: { id: string }) {
  const event = await getEvent(id);
  if (!event || !event.canEdit) notFound();

  return (
    <>
      <BackLink href={`/events/${event.id}`} label={event.title} />
      <h1 className="text-2xl font-bold tracking-tight">약속 수정</h1>
      <EventForm
        action={updateEvent.bind(null, event.id)}
        initialValues={{
          title: event.title,
          startsAt: toKstInput(event.startsAt),
          placeName: event.placeName ?? "",
          minPeople: event.minPeople?.toString() ?? "",
          maxPeople: event.maxPeople?.toString() ?? "",
          memo: event.memo ?? "",
        }}
        submitLabel="저장"
      />
    </>
  );
}
