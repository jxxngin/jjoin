import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Avatar } from "@/components/avatar";
import { DaysLeftBadge } from "@/components/event-card";
import { PersonName } from "@/components/person-name";
import { BackLink } from "@/components/back-link";
import { formatEventDate } from "@/lib/datetime";
import { StatusBadge } from "@/components/status-badge";
import { MarkEventSeen } from "@/components/unread-comments";
import { END_REASON_LABELS, formatGoing } from "@/lib/event-status";
import { googleCalendarUrl } from "@/lib/calendar-export";
import { getEvent, type Participant } from "@/lib/events";
import { reopenEvent } from "../actions";
import { CalendarMenu } from "./calendar-menu";
import { Comments } from "./comments";
import { DeleteEventButton } from "./delete-button";
import { EndEventForm } from "./end-event-form";
import { ParticipationButtons } from "./participation-buttons";
import { PlaceMap } from "./place-map";
import { Page, Reveal } from "@/components/slide-view";

export default function EventPage({ params }: PageProps<"/events/[id]">) {
  return (
    <Page className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-6">
      <Suspense fallback={<div className="h-80 animate-pulse rounded-2xl bg-stone-100 dark:bg-stone-900" />}>
        {params.then(({ id }) => (
          <EventContent id={id} />
        ))}
      </Suspense>
    </Page>
  );
}

async function EventContent({ id }: { id: string }) {
  const event = await getEvent(id);
  if (!event) notFound();

  const { status } = event;
  const { going, waitlisted, maybe, not_going } = event.participants;
  const host = (await headers()).get("host");
  const eventUrl = `https://${host}/events/${event.id}`;

  return (
    <Reveal className="flex flex-1 flex-col gap-6">
      <MarkEventSeen eventId={event.id} />
      <BackLink href={`/groups/${event.group.id}`} label={event.group.name} />

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          {event.daysLeft !== null && status !== "ended" && <DaysLeftBadge days={event.daysLeft} />}
          <StatusBadge status={status} />
          <span className="text-sm text-stone-500">
            {formatGoing(event.goingCount, event.maxPeople)} 참여
          </span>
        </div>
        <div className="flex items-start gap-2">
          <h1 className="min-w-0 flex-1 text-2xl font-bold tracking-tight">{event.title}</h1>
          {status !== "ended" && (
            <CalendarMenu
              googleUrl={googleCalendarUrl(
                {
                  id: event.id,
                  title: event.title,
                  startsAt: event.startsAt,
                  placeName: event.placeName,
                  address: event.place?.address ?? null,
                  memo: event.memo,
                },
                eventUrl,
              )}
              icsUrl={`/events/${event.id}/ics`}
            />
          )}
        </div>
        {event.creator && (
          <p className="flex items-center gap-2 text-sm text-stone-500">
            <Avatar src={event.creator.avatarUrl} color={event.creator.avatarColor} size="sm" />
            <span>
              <PersonName
                nickname={event.creator.nickname}
                kakaoName={event.creator.kakaoName}
                className="font-medium text-stone-700 dark:text-stone-300"
              />
              님이 만든 약속
            </span>
          </p>
        )}
      </div>

      {event.endReason && (
        <section className="flex flex-col gap-2 rounded-2xl border border-stone-200 px-4 py-3 dark:border-stone-800">
          <p className="text-sm">
            <span className="font-semibold">종료된 약속</span>
            <span className="text-stone-500"> · {END_REASON_LABELS[event.endReason]}</span>
          </p>
          {event.endNote && <p className="text-sm text-stone-600 dark:text-stone-400">{event.endNote}</p>}
          {event.canReopen && (
            <form action={reopenEvent}>
              <input type="hidden" name="eventId" value={event.id} />
              <button type="submit" className="text-sm font-medium text-brand-ink underline underline-offset-4">
                다시 열기
              </button>
            </form>
          )}
        </section>
      )}

      <dl className="flex flex-col gap-3 rounded-2xl bg-stone-100 p-4 dark:bg-stone-900">
        <Row label="언제">{formatEventDate(event.startsAt)}</Row>
        <Row label="어디서">
          {event.placeName ?? "미정"}
          {event.place?.address && (
            <span className="block text-sm text-stone-500">{event.place.address}</span>
          )}
        </Row>
        {event.maxPeople && <Row label="인원">최대 {event.maxPeople}명</Row>}
      </dl>

      {event.place && event.placeName && (
        <section className="flex flex-col gap-2">
          <PlaceMap lat={event.place.lat} lng={event.place.lng} />
          <div className="grid grid-cols-2 gap-2">
            <a
              href={event.place.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-11 items-center justify-center rounded-xl bg-stone-100 text-sm font-medium dark:bg-stone-900"
            >
              카카오맵에서 보기
            </a>
            <a
              href={`https://map.kakao.com/link/to/${encodeURIComponent(event.placeName)},${event.place.lat},${event.place.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-11 items-center justify-center rounded-xl bg-stone-100 text-sm font-medium dark:bg-stone-900"
            >
              길찾기
            </a>
          </div>
        </section>
      )}

      {status !== "ended" && (
        <section className="flex flex-col gap-2">
          <ParticipationButtons
            eventId={event.id}
            myStatus={event.myStatus}
            isFull={status === "full"}
          />
          {event.myWaitlistRank && (
            <p className="text-sm text-stone-500">
              대기 {event.myWaitlistRank}번째예요. 자리가 나면 자동으로 참여돼요.
            </p>
          )}
        </section>
      )}

      <section className="flex flex-col gap-4">
        <PeopleList title="참여" people={going} creatorId={event.creatorId} />
        <PeopleList title="대기" people={waitlisted} creatorId={event.creatorId} numbered />
        <PeopleList title="미정" people={maybe} creatorId={event.creatorId} />
        <PeopleList title="불참" people={not_going} creatorId={event.creatorId} />
      </section>

      {event.memo && (
        <section className="flex flex-col gap-2">
          <h2 className="font-semibold">메모</h2>
          <p className="whitespace-pre-wrap text-stone-700 dark:text-stone-300">{event.memo}</p>
        </section>
      )}

      <Suspense fallback={<div className="h-24 animate-pulse rounded-2xl bg-stone-100 dark:bg-stone-900" />}>
        <Comments eventId={event.id} groupId={event.group.id} />
      </Suspense>

      {event.canEdit && (
        <div className="mt-auto flex flex-col gap-2">
          {status !== "ended" && (
            <div className="flex">
              <EndEventForm eventId={event.id} />
            </div>
          )}
          <div className="flex gap-2">
            <Link
              href={`/events/${event.id}/edit`}
              transitionTypes={["nav-forward"]}
              className="flex h-12 flex-1 items-center justify-center rounded-xl bg-stone-100 font-medium dark:bg-stone-900"
            >
              수정
            </Link>
            <DeleteEventButton eventId={event.id} groupId={event.group.id} />
          </div>
        </div>
      )}
    </Reveal>
  );
}

function PeopleList({
  title,
  people,
  creatorId,
  numbered,
}: {
  title: string;
  people: Participant[];
  creatorId: string;
  numbered?: boolean;
}) {
  if (people.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold text-stone-500">
        {title} {people.length}
      </h2>
      <ul className="flex flex-wrap gap-x-4 gap-y-2">
        {people.map((person, i) => (
          <li key={person.id} className="flex items-center gap-2">
            <Avatar src={person.avatarUrl} color={person.avatarColor} size="sm" />
            <span className="text-sm">
              {numbered && <span className="mr-1 text-stone-500">{i + 1}.</span>}
              <PersonName nickname={person.nickname} kakaoName={person.kakaoName} />
            </span>
            {person.id === creatorId && <CreatorIcon />}
          </li>
        ))}
      </ul>
    </div>
  );
}

function CreatorIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="size-4 shrink-0 text-amber-500"
      role="img"
      aria-label="만든 사람"
    >
      <title>만든 사람</title>
      <path
        fill="currentColor"
        d="M2 5.5 5 8l3-4.5L11 8l3-2.5-1.2 6.5H3.2L2 5.5Zm1.3 7.5h9.4v1.2H3.3V13Z"
      />
    </svg>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <dt className="w-12 shrink-0 text-sm text-stone-500">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
