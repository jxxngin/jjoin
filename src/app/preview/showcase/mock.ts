// README 스크린샷용 가짜 데이터. 실제 DB와 관계없다.
import type { CalendarItem } from "@/components/calendar";
import type { EventSummary } from "@/lib/events";
import type { GroupMember } from "@/lib/groups";

export const TODAY = "2026-10-15";

function event(
  id: string,
  title: string,
  startsAt: string,
  daysLeft: number | null,
  extra: Partial<EventSummary> = {},
): EventSummary {
  return {
    id,
    title,
    startsAt,
    placeName: null,
    maxPeople: null,
    goingCount: 3,
    status: "recruiting",
    endReason: null,
    endNote: null,
    endedManually: false,
    daysLeft,
    creator: { nickname: "민수", kakaoName: "김민수", avatarUrl: null, avatarColor: "mint" },
    otherCommentTimes: [],
    ...extra,
  };
}

export const GROUPS = {
  friends: { name: "대학 동기", emoji: "🍻", color: "amber" as const },
  hiking: { name: "산악회", emoji: "🧗", color: "emerald" as const },
  work: { name: "회사 동료", emoji: "🎮", color: "violet" as const },
};

export const MY_CALENDAR: CalendarItem[] = [
  { event: event("e1", "치맥", "2026-10-15T10:00:00Z", 0, { goingCount: 4, maxPeople: 6 }), group: GROUPS.friends },
  { event: event("e2", "점심 국밥", "2026-10-16T03:30:00Z", 1, { goingCount: 3, maxPeople: 3, status: "full" }), group: GROUPS.work },
  { event: event("e3", "북한산", "2026-10-17T00:00:00Z", 2, { goingCount: 5 }), group: GROUPS.hiking },
  { event: event("e4", "보드게임", "2026-10-17T11:00:00Z", 2, { goingCount: 2, maxPeople: 8 }), group: GROUPS.work },
  { event: event("e5", "영화 번개", "2026-10-12T05:00:00Z", null, { status: "ended", endReason: "time_passed" }), group: GROUPS.friends },
];

export const GROUP_EVENTS: EventSummary[] = [
  event("g1", "금요일 치맥", "2026-10-16T10:00:00Z", 1, { placeName: "건대입구", goingCount: 4, maxPeople: 6 }),
  event("g2", "주말 등산", "2026-10-18T00:00:00Z", 3, { placeName: "북한산", goingCount: 5, maxPeople: 8 }),
  event("g3", "보드게임 모임", "2026-10-21T11:00:00Z", 6, { placeName: "홍대", goingCount: 2, maxPeople: 8 }),
  event("g4", "연말 송년회", "2026-10-27T10:00:00Z", 12, { placeName: "강남역", goingCount: 7, maxPeople: 20 }),
  event("g5", "볼링 번개", "2026-10-19T11:00:00Z", 4, { placeName: "잠실", goingCount: 4, maxPeople: 4, status: "full" }),
];

export const MEMBERS: GroupMember[] = [
  { id: "m1", nickname: "민수", kakaoName: "김민수", avatarUrl: null, avatarColor: "mint", role: "owner" },
  { id: "m2", nickname: "지원", kakaoName: "지원", avatarUrl: null, avatarColor: "pink", role: "member" },
  { id: "m3", nickname: "현우", kakaoName: "박현우", avatarUrl: null, avatarColor: "sky", role: "member" },
  { id: "m4", nickname: "서연", kakaoName: "서연", avatarUrl: null, avatarColor: "butter", role: "member" },
  { id: "m5", nickname: "도윤", kakaoName: "도윤", avatarUrl: null, avatarColor: "lavender", role: "member" },
  { id: "m6", nickname: "하린", kakaoName: "하린", avatarUrl: null, avatarColor: "peach", role: "member" },
  { id: "m7", nickname: "준호", kakaoName: "준호", avatarUrl: null, avatarColor: "mint", role: "member" },
];
