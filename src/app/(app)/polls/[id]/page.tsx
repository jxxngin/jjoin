import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Avatar } from "@/components/avatar";
import { BackLink } from "@/components/back-link";
import { Page, Reveal } from "@/components/slide-view";
import { formatDayRange, formatEventDate } from "@/lib/datetime";
import { getPoll, topOptions, type PollOption } from "@/lib/polls";
import { ConfirmButton, PollManage, VoteButton } from "./poll-controls";

const MEDALS = ["🥇", "🥈", "🥉"];

// 후보 이름. 당일 투표는 "10월 18일 (일) 오후 7:00", 기간 투표는 "10월 24일 (금) ~ 10월 26일 (일) · 2박 3일"
function optionLabel(option: PollOption) {
  return option.endsAt ? formatDayRange(option.startsAt, option.endsAt) : formatEventDate(option.startsAt);
}

// 기간 투표의 출발 시간 "오전 10:00" (모든 후보가 같다)
const timeFormat = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", hour: "numeric", minute: "2-digit" });

export default function PollPage({ params }: PageProps<"/polls/[id]">) {
  return (
    <Page className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-6">
      <Suspense fallback={<div className="h-80 animate-pulse rounded-2xl bg-stone-100 dark:bg-stone-900" />}>
        {params.then(({ id }) => (
          <PollContent id={id} />
        ))}
      </Suspense>
    </Page>
  );
}

function Voters({ option }: { option: PollOption }) {
  if (option.voters.length === 0) return <span className="text-xs text-stone-400">아직 없어요</span>;
  return (
    <span className="flex items-center gap-1.5">
      <span className="flex -space-x-1.5">
        {option.voters.slice(0, 5).map((voter) => (
          <span key={voter.id} className="rounded-full ring-2 ring-background" title={voter.nickname}>
            <Avatar src={voter.avatarUrl} color={voter.avatarColor} size="xs" />
          </span>
        ))}
      </span>
      <span className="text-xs text-stone-500">{option.voters.length}명</span>
    </span>
  );
}

async function PollContent({ id }: { id: string }) {
  const poll = await getPoll(id);
  if (!poll) notFound();

  const maxVotes = Math.max(1, ...poll.options.map((o) => o.voters.length));
  const top = topOptions(poll.options);

  return (
    <Reveal className="flex flex-1 flex-col gap-6">
      <BackLink href={`/groups/${poll.group.id}`} label={poll.group.name} />

      <div className="flex flex-col gap-2">
        <span className="w-fit rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-950 dark:text-violet-300">
          {poll.kind === "trip" ? "🧳 기간 투표" : "⏰ 당일 투표"} · {poll.closed ? "마감" : "투표 중"}
        </span>
        <h1 className="text-2xl font-bold tracking-tight">{poll.title}</h1>
        <p className="text-sm text-stone-500">
          {[
            poll.kind === "trip" && poll.options[0] && `출발 ${timeFormat.format(new Date(poll.options[0].startsAt))}`,
            poll.placeName,
            poll.maxPeople && `최대 ${poll.maxPeople}명`,
            `${poll.voterCount}명 참여`,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {poll.memo && <p className="text-sm whitespace-pre-wrap text-stone-600 dark:text-stone-400">{poll.memo}</p>}
      </div>

      {poll.eventId && (
        <Link
          href={`/events/${poll.eventId}`}
          transitionTypes={["nav-forward"]}
          className="flex items-center justify-between rounded-2xl bg-emerald-100 px-4 py-3 text-sm font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
        >
          약속으로 확정됐어요
          <span>보러 가기 ›</span>
        </Link>
      )}

      {poll.closed && !poll.eventId && (
        <section className="flex flex-col gap-3">
          <h2 className="font-semibold">투표 결과 · 가장 많이 고른 후보</h2>
          {top.length === 0 ? (
            <p className="text-sm text-stone-500">투표한 사람이 없어요. 투표를 다시 열어 보세요.</p>
          ) : (
            <ol className="flex flex-col gap-2">
              {top.map((option, i) => (
                <li key={option.id} className="flex items-center gap-3 rounded-2xl bg-stone-100 px-4 py-3 dark:bg-stone-900">
                  <span className="text-2xl" aria-label={`${i + 1}위`}>
                    {MEDALS[i]}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="font-medium">{optionLabel(option)}</span>
                    <Voters option={option} />
                  </div>
                  {poll.canManage && (
                    <ConfirmButton pollId={poll.id} optionId={option.id} label={optionLabel(option)} />
                  )}
                </li>
              ))}
            </ol>
          )}
          {!poll.canManage && top.length > 0 && (
            <p className="text-xs text-stone-500">만든 사람이 이 중에서 날짜를 확정하면 약속이 만들어져요.</p>
          )}
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">
          {poll.closed ? "전체 결과" : poll.kind === "trip" ? "되는 기간을 모두 골라 주세요" : "되는 날짜를 모두 골라 주세요"}
        </h2>
        <ul className="flex flex-col gap-2">
          {poll.options.map((option) => (
            <li key={option.id} className="relative overflow-hidden rounded-2xl border border-stone-200 px-4 py-3 dark:border-stone-800">
              {/* 표 수만큼 배경 막대가 찬다. */}
              <span
                aria-hidden="true"
                className="absolute inset-y-0 left-0 bg-brand/10 transition-[width] duration-500"
                style={{ width: `${(option.voters.length / maxVotes) * 100}%` }}
              />
              <div className="relative flex items-center gap-3">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="font-medium">{optionLabel(option)}</span>
                  <Voters option={option} />
                </div>
                {!poll.closed && <VoteButton optionId={option.id} voted={option.votedByMe} />}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {poll.canManage && !poll.eventId && (
        <div className="mt-auto">
          <PollManage pollId={poll.id} groupId={poll.group.id} closed={poll.closed} />
        </div>
      )}
    </Reveal>
  );
}
