import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Avatar } from "@/components/avatar";
import { DaysLeftBadge } from "@/components/event-card";
import { PersonName } from "@/components/person-name";
import { BackLink } from "@/components/back-link";
import { formatEventPeriod } from "@/lib/datetime";
import { StatusBadge } from "@/components/status-badge";
import { MarkEventSeen } from "@/components/unread-comments";
import { END_REASON_LABELS, formatGoing } from "@/lib/event-status";
import { googleCalendarUrl } from "@/lib/calendar-export";
import { getEvent, type Participant } from "@/lib/events";
import { getEventInvite } from "@/lib/event-invite";
import { joinGroup } from "@/app/(app)/groups/actions";
import { GroupAvatar } from "@/components/group-avatar";
import { reopenEvent } from "../actions";
import { CalendarMenu } from "./calendar-menu";
import { CopyLinkButton } from "./copy-link-button";
import { Comments } from "./comments";
import { DeleteEventButton } from "./delete-button";
import { EndEventForm } from "./end-event-form";
import { ParticipationButtons } from "./participation-buttons";
import { PlaceMap } from "./place-map";
import { Page, Reveal } from "@/components/slide-view";

export default function EventPage({ params, searchParams }: PageProps<"/events/[id]">) {
  return (
    <Page className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-6">
      <Suspense fallback={<div className="h-80 animate-pulse rounded-2xl bg-stone-100 dark:bg-stone-900" />}>
        {Promise.all([params, searchParams]).then(([{ id }, query]) => (
          <EventContent id={id} invite={typeof query.invite === "string" ? query.invite : null} />
        ))}
      </Suspense>
    </Page>
  );
}

// invite: 약속 공유 링크에 붙은 그룹 초대 코드. 그룹 밖 사람이면 참여 안내를 보여 준다.
async function EventContent({ id, invite }: { id: string; invite: string | null }) {
  const event = await getEvent(id);
  if (!event) {
    if (invite) return <EventJoin eventId={id} code={invite} />;
    notFound();
  }

  const { status } = event;
  const { going, waitlisted, maybe, not_going } = event.participants;
  const host = (await headers()).get("host");
  const eventUrl = `https://${host}/events/${event.id}`;
  const shareUrl = `${eventUrl}?invite=${event.group.inviteCode}`;

  return (
    <Reveal className="flex flex-1 flex-col gap-6">
      <MarkEventSeen eventId={event.id} commentTimes={event.otherCommentTimes} />
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
          <CopyLinkButton url={shareUrl} />
          {status !== "ended" && (
            <CalendarMenu
              googleUrl={googleCalendarUrl(
                {
                  id: event.id,
                  title: event.title,
                  startsAt: event.startsAt,
                  endsAt: event.endsAt,
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
        <Row label="언제">{formatEventPeriod(event.startsAt, event.endsAt)}</Row>
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
            waitlistRank={event.myWaitlistRank}
          />
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

// 약속 공유 링크로 그룹 밖 사람이 들어왔을 때: 어떤 약속인지 보여 주고, 그룹에 참여하면 이 약속으로 돌아온다.
// 초대 코드가 이 약속의 그룹 것이 아니면(또는 초대 링크를 새로 만들어 예전 코드면) 볼 수 없다고 안내한다.
async function EventJoin({ eventId, code }: { eventId: string; code: string }) {
  const invite = await getEventInvite(eventId, code);
  if (!invite || invite.isMember) notFound();

  return (
    <Reveal className="flex flex-1 flex-col items-center justify-center gap-6 py-10 text-center">
      <div className="flex flex-col items-center gap-2">
        <GroupAvatar emoji={invite.emoji} color={invite.color} size="lg" />
        <p className="text-sm text-stone-500">
          <b className="text-foreground">{invite.groupName}</b> 그룹의 약속이에요 · 멤버 {invite.memberCount}명
        </p>
        <h1 className="text-2xl font-bold tracking-tight">{invite.event.title}</h1>
        <p className="text-stone-600 dark:text-stone-400">
          {formatEventPeriod(invite.event.startsAt, invite.event.endsAt)}
        </p>
      </div>
      <p className="text-sm text-stone-500">그룹에 참여하면 약속을 보고 참여 여부를 정할 수 있어요.</p>
      <form action={joinGroup} className="w-full">
        <input type="hidden" name="code" value={code} />
        <input type="hidden" name="next" value={`/events/${eventId}`} />
        <button
          type="submit"
          className="h-12 w-full rounded-xl bg-brand font-medium text-white transition active:scale-[0.98]"
        >
          그룹에 참여하고 약속 보기
        </button>
      </form>
    </Reveal>
  );
}
