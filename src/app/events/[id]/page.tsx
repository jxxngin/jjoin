import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Avatar } from "@/components/avatar";
import { BackLink } from "@/components/back-link";
import { formatEventDate } from "@/lib/datetime";
import { StatusBadge } from "@/components/status-badge";
import { formatGoing } from "@/lib/event-status";
import { getEvent, type Participant } from "@/lib/events";
import { formatPeople } from "../format";
import { DeleteEventButton } from "./delete-button";
import { ParticipationButtons } from "./participation-buttons";

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
  const { status } = event;
  const { going, waitlisted, maybe, not_going } = event.participants;

  return (
    <>
      <BackLink href={`/groups/${event.group.id}`} label={event.group.name} />

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <StatusBadge status={status} />
          <span className="text-sm text-zinc-500">
            {formatGoing(event.goingCount, event.maxPeople)} 참여
          </span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">{event.title}</h1>
      </div>

      <dl className="flex flex-col gap-3 rounded-2xl bg-zinc-100 p-4 dark:bg-zinc-900">
        <Row label="언제">{formatEventDate(event.startsAt)}</Row>
        <Row label="어디서">{event.placeName ?? "미정"}</Row>
        {people && <Row label="인원">{people}</Row>}
      </dl>

      {status !== "past" && (
        <section className="flex flex-col gap-2">
          <ParticipationButtons
            eventId={event.id}
            myStatus={event.myStatus}
            isFull={status === "full"}
          />
          {event.myWaitlistRank && (
            <p className="text-sm text-zinc-500">
              대기 {event.myWaitlistRank}번째예요. 자리가 나면 자동으로 참여돼요.
            </p>
          )}
        </section>
      )}

      <section className="flex flex-col gap-4">
        <PeopleList title="참여" people={going} />
        <PeopleList title="대기" people={waitlisted} numbered />
        <PeopleList title="미정" people={maybe} />
        <PeopleList title="불참" people={not_going} />
      </section>

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

function PeopleList({
  title,
  people,
  numbered,
}: {
  title: string;
  people: Participant[];
  numbered?: boolean;
}) {
  if (people.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold text-zinc-500">
        {title} {people.length}
      </h2>
      <ul className="flex flex-wrap gap-x-4 gap-y-2">
        {people.map((person, i) => (
          <li key={person.id} className="flex items-center gap-2">
            <Avatar src={person.avatarUrl} size="sm" />
            <span className="text-sm">
              {numbered && <span className="mr-1 text-zinc-500">{i + 1}.</span>}
              {person.nickname}
            </span>
          </li>
        ))}
      </ul>
    </div>
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
