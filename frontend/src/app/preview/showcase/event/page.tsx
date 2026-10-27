// README 스크린샷용: 약속 상세 화면을 가짜 데이터로 그린다.
import { Avatar } from "@/components/avatar";
import { DaysLeftBadge } from "@/components/event-card";
import { PersonName } from "@/components/person-name";
import { StatusBadge } from "@/components/status-badge";
import { ParticipationButtons } from "@/app/(app)/events/[id]/participation-buttons";
import { MEMBERS } from "../mock";

const going = MEMBERS.slice(0, 4);
const waiting = MEMBERS.slice(4, 6);
const COMMENTS = [
  { who: MEMBERS[1], at: "10월 14일 (수) 오후 9:12", body: "저 7시 반쯤 도착할 것 같아요!" },
  { who: MEMBERS[0], at: "10월 14일 (수) 오후 9:20", body: "자리 예약해 둘게요 🍗" },
];

export default function ShowcaseEvent() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <DaysLeftBadge days={1} />
          <StatusBadge status="full" />
          <span className="text-sm text-stone-500">4/4명 참여</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">금요일 치맥</h1>
        <p className="flex items-center gap-2 text-sm text-stone-500">
          <Avatar src={null} color="mint" size="sm" />
          <span>
            <PersonName nickname="민수" kakaoName="김민수" className="font-medium text-stone-700 dark:text-stone-300" />
            님이 만든 약속
          </span>
        </p>
      </div>

      <dl className="flex flex-col gap-3 rounded-2xl bg-stone-100 p-4 dark:bg-stone-900">
        <div className="flex gap-4"><dt className="w-12 shrink-0 text-sm text-stone-500">언제</dt><dd>10월 16일 (금) 오후 7:00</dd></div>
        <div className="flex gap-4"><dt className="w-12 shrink-0 text-sm text-stone-500">어디서</dt><dd>건대입구 치킨집<span className="block text-sm text-stone-500">서울 광진구 아차산로 200</span></dd></div>
        <div className="flex gap-4"><dt className="w-12 shrink-0 text-sm text-stone-500">인원</dt><dd>최대 4명</dd></div>
      </dl>

      <section className="flex flex-col gap-2">
        <ParticipationButtons eventId="demo" myStatus="waitlisted" isFull waitlistRank={1} />
      </section>

      <section className="flex flex-col gap-4">
        {[["참여", going], ["대기", waiting]].map(([title, people]) => (
          <div key={title as string} className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-stone-500">{title as string} {(people as typeof MEMBERS).length}</h2>
            <ul className="flex flex-wrap gap-x-4 gap-y-2">
              {(people as typeof MEMBERS).map((person, i) => (
                <li key={person.id} className="flex items-center gap-2 text-sm">
                  <Avatar src={null} color={person.avatarColor} size="sm" />
                  {title === "대기" && <span className="text-stone-500">{i + 1}.</span>}
                  <PersonName nickname={person.nickname} kakaoName={person.kakaoName} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">댓글 {COMMENTS.length}</h2>
        <ul className="flex flex-col gap-3">
          {COMMENTS.map((comment) => (
            <li key={comment.at} className="flex gap-3">
              <Avatar src={null} color={comment.who.avatarColor} size="sm" />
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2 text-sm">
                  <PersonName nickname={comment.who.nickname} kakaoName={comment.who.kakaoName} className="font-medium" />
                  <span className="text-xs text-stone-400">{comment.at}</span>
                </div>
                <p className="text-sm text-stone-700 dark:text-stone-300">{comment.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
