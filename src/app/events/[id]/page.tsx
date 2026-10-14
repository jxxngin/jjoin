import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Avatar } from "@/components/avatar";
import { BackLink } from "@/components/back-link";
import { formatEventDate } from "@/lib/datetime";
import { getEvent } from "@/lib/events";
import { formatPeople } from "../format";
import { DeleteEventButton } from "./delete-button";

export default function EventPage({ params }: PageProps<"/events/[id]">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-6">
      <Suspense fallback={<div className="h-80 animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-900" />}>
        {params.then(({ id }) => (
          <EventContent id={id} />
        ))}
      </Suspense>
    </main>
  );
}

async function EventContent({ id }: { id: string }) {
  const event = await getEvent(id);
  if (!event) notFound();

  const people = formatPeople(event.minPeople, event.maxPeople);

  return (
    <>
      <BackLink href={`/groups/${event.group.id}`} label={event.group.name} />

      <h1 className="text-2xl font-bold tracking-tight">{event.title}</h1>

      <dl className="flex flex-col gap-3 rounded-2xl bg-zinc-100 p-4 dark:bg-zinc-900">
        <Row label="언제">{formatEventDate(event.startsAt)}</Row>
        <Row label="어디서">{event.placeName ?? "미정"}</Row>
        {people && <Row label="인원">{people}</Row>}
      </dl>

      {event.memo && (
        <section className="flex flex-col gap-2">
          <h2 className="font-semibold">메모</h2>
          <p className="whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">{event.memo}</p>
        </section>
      )}

      {event.creator && (
        <p className="flex items-center gap-2 text-sm text-zinc-500">
          <Avatar src={event.creator.avatarUrl} size="sm" />
          {event.creator.nickname}님이 만든 약속
        </p>
      )}

      {event.canEdit && (
        <div className="mt-auto flex gap-2">
          <Link
            href={`/events/${event.id}/edit`}
            className="flex h-12 flex-1 items-center justify-center rounded-xl bg-zinc-100 font-medium dark:bg-zinc-900"
          >
            수정
          </Link>
          <DeleteEventButton eventId={event.id} groupId={event.group.id} />
        </div>
      )}
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <dt className="w-12 shrink-0 text-sm text-zinc-500">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
