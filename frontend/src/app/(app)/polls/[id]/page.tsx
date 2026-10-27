import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Avatar } from "@/components/avatar";
import { BackLink } from "@/components/back-link";
import { Page, Reveal } from "@/components/slide-view";
import { Period } from "@/components/period";
import { eventPeriodParts } from "@/lib/datetime";
import { getPoll, topOptions, type PollOption } from "@/lib/polls";
import { ConfirmButton, PollManage, VoteButton } from "./poll-controls";
import { CommentSection, mentionablesFrom } from "@/app/(app)/events/[id]/comments";
import { CopyLinkButton } from "@/app/(app)/events/[id]/copy-link-button";
import { joinGroup } from "@/app/(app)/groups/actions";
import { GroupAvatar } from "@/components/group-avatar";
import { getPollInvite } from "@/lib/event-invite";
import { headers } from "next/headers";
import { PlaceVote } from "@/app/(app)/events/[id]/place-vote-section";
import { getUserId } from "@/lib/auth";
import { getPollComments } from "@/lib/comments";
import { getGroup } from "@/lib/groups";
import { deletePollComment, editPollComment, postPollComment } from "../actions";

const MEDALS = ["🥇", "🥈", "🥉"];

// 후보 이름. 당일 투표는 "10월 18일 (일) 오후 7:00", 기간 투표는 "10월 24일 (금) ~ 10월 26일 (일)" + "2박 3일" 배지
function OptionLabel({ option }: { option: PollOption }) {
  return <Period startsAt={option.startsAt} endsAt={option.endsAt} withTime={!option.endsAt} />;
}

// 확정 확인 문구에 쓰는 글자 버전
function labelText(option: PollOption) {
  const { dates, nights } = eventPeriodParts(option.startsAt, option.endsAt, !option.endsAt);
  return nights ? `${dates} (${nights})` : dates;
}

// 기간 투표의 출발 시간 "오전 10:00" (모든 후보가 같다)
const timeFormat = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", hour: "numeric", minute: "2-digit" });

export default function PollPage({ params, searchParams }: PageProps<"/polls/[id]">) {
  return (
    <Page className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-6">
      <Suspense fallback={<div className="h-80 animate-pulse rounded-2xl bg-stone-100 dark:bg-stone-900" />}>
        {Promise.all([params, searchParams]).then(([{ id }, query]) => (
          <PollContent id={id} invite={typeof query.invite === "string" ? query.invite : null} />
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

// invite: 투표 공유 링크에 붙은 그룹 초대 코드. 그룹 밖 사람이면 참여 안내를 보여 준다.
async function PollContent({ id, invite }: { id: string; invite: string | null }) {
  const poll = await getPoll(id);
  if (!poll) {
    if (invite) return <PollJoin pollId={id} code={invite} />;
    notFound();
  }
  const host = (await headers()).get("host");

  const maxVotes = Math.max(1, ...poll.options.map((o) => o.voters.length));
  const top = topOptions(poll.options);

  return (
    <Reveal className="flex flex-1 flex-col gap-6">
      <BackLink href={`/groups/${poll.group.id}`} label={poll.group.name} />

      <div className="flex flex-col gap-2">
        <span className="w-fit rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-950 dark:text-violet-300">
          {poll.kind === "trip" ? "🧳 기간 투표" : "⏰ 당일 투표"} · {poll.closed ? "마감" : "투표 중"}
        </span>
        <div className="flex items-start gap-2">
          <h1 className="min-w-0 flex-1 text-2xl font-bold tracking-tight">{poll.title}</h1>
          <CopyLinkButton url={`https://${host}/polls/${poll.id}?invite=${poll.group.inviteCode}`} />
        </div>
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
                    <span className="font-medium"><OptionLabel option={option} /></span>
                    <Voters option={option} />
                  </div>
                  {poll.canManage && (
                    <ConfirmButton pollId={poll.id} optionId={option.id} label={labelText(option)} />
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
                  <span className="font-medium"><OptionLabel option={option} /></span>
                  <Voters option={option} />
                </div>
                {!poll.closed && <VoteButton optionId={option.id} voted={option.votedByMe} />}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* 약속으로 확정되면 장소 후보는 약속으로 옮겨 가므로 여기서는 보이지 않는다. */}
      {!poll.eventId && (
        <Suspense fallback={null}>
          <PlaceVote target={{ kind: "poll", id: poll.id }} hasPlace={poll.placeName !== null} canManage={poll.canManage} />
        </Suspense>
      )}

      <Suspense fallback={<div className="h-24 animate-pulse rounded-2xl bg-stone-100 dark:bg-stone-900" />}>
        <PollComments pollId={poll.id} groupId={poll.group.id} />
      </Suspense>

      {poll.canManage && !poll.eventId && (
        <div className="mt-auto">
          <PollManage pollId={poll.id} groupId={poll.group.id} closed={poll.closed} />
        </div>
      )}
    </Reveal>
  );
}

// 투표 아래 댓글. "이 날은 안 돼요" 같은 이야기를 나눈다. @언급·답글·수정이 된다. (하트는 약속 댓글만)
async function PollComments({ pollId, groupId }: { pollId: string; groupId: string }) {
  const [comments, userId, group] = await Promise.all([getPollComments(pollId), getUserId(), getGroup(groupId)]);
  const members = group?.members ?? [];
  return (
    <CommentSection
      comments={comments}
      userId={userId}
      nicknameById={new Map(members.map((m) => [m.id, m.nickname]))}
      post={postPollComment.bind(null, pollId)}
      edit={editPollComment}
      remove={deletePollComment}
      withLikes={false}
      mentionables={mentionablesFrom(members, userId)}
    />
  );
}

// 투표 공유 링크로 그룹 밖 사람이 들어왔을 때: 어떤 투표인지 보여 주고, 그룹에 참여하면 이 투표로 돌아온다.
// 초대 코드가 이 투표의 그룹 것이 아니면(또는 초대 링크를 새로 만들어 예전 코드면) 볼 수 없다고 안내한다.
async function PollJoin({ pollId, code }: { pollId: string; code: string }) {
  const invite = await getPollInvite(pollId, code);
  if (!invite || invite.isMember) notFound();

  return (
    <Reveal className="flex flex-1 flex-col items-center justify-center gap-6 py-10 text-center">
      <div className="flex flex-col items-center gap-2">
        <GroupAvatar emoji={invite.emoji} color={invite.color} size="lg" />
        <p className="text-sm text-stone-500">
          <b className="text-foreground">{invite.groupName}</b> 그룹의 투표예요 · 멤버 {invite.memberCount}명
        </p>
        <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-950 dark:text-violet-300">
          {invite.poll.kind === "trip" ? "🧳 기간 투표" : "⏰ 당일 투표"}
        </span>
        <h1 className="text-2xl font-bold tracking-tight">{invite.poll.title}</h1>
      </div>
      <p className="text-sm text-stone-500">그룹에 참여하면 되는 날에 바로 투표할 수 있어요.</p>
      <form action={joinGroup} className="w-full">
        <input type="hidden" name="code" value={code} />
        <input type="hidden" name="next" value={`/polls/${pollId}`} />
        <button
          type="submit"
          className="h-12 w-full rounded-xl bg-brand font-medium text-white transition active:scale-[0.98]"
        >
          그룹에 참여하고 투표하기
        </button>
      </form>
    </Reveal>
  );
}
