import "server-only";
import type { AvatarColor } from "@/lib/avatar-style";
import type { GroupColor } from "@/lib/group-style";
import { getUserId } from "@/lib/auth";
import { getVisibleKakaoNames } from "@/lib/kakao-names";
import { daysUntil } from "@/lib/datetime";
import {
  getEndReason,
  getEventStatus,
  type EndReason,
  type EventStatus,
  type ParticipantStatus,
} from "@/lib/event-status";
import { createClient } from "@/lib/supabase/server";

export type EventSummary = {
  id: string;
  title: string;
  startsAt: string;
  // 여러 날 약속(2박 3일 등)이 끝나는 시각. 하루 약속이면 null (src/lib/datetime.ts)
  endsAt: string | null;
  placeName: string | null;
  maxPeople: number | null;
  goingCount: number;
  status: EventStatus;
  // 종료된 약속만 있다. 시간이 지나 끝났으면 time_passed
  endReason: EndReason | null;
  endNote: string | null;
  // 만든 사람·방장이 직접 종료했는지 (다시 열 수 있는지 판단)
  endedManually: boolean;
  // 며칠 남았는지 (오늘 0, 여러 날 약속이 진행 중이어도 0). 지난 약속이면 null
  daysLeft: number | null;
  creator: Person | null;
  // 다른 사람이 쓴 댓글 시각. 화면에서 "안 읽은 댓글" 배지를 계산한다. (내가 이 약속을 마지막으로 본 시각과 비교)
  otherCommentTimes: string[];
  // 내가 이 약속을 마지막으로 본 시각 (서버 기록, 모든 기기 공통). 본 적 없으면 null
  seenAt: string | null;
};

export type Person = {
  nickname: string;
  kakaoName: string | null;
  avatarUrl: string | null;
  avatarColor: AvatarColor;
};

export type Participant = {
  id: string;
  nickname: string;
  kakaoName: string | null;
  avatarUrl: string | null;
  avatarColor: AvatarColor;
};

export type EventDetail = EventSummary & {
  // 카카오맵에서 고른 장소일 때만 있다.
  place: { address: string | null; lat: number; lng: number; url: string } | null;
  memo: string | null;
  // inviteCode: 약속 공유 링크에 붙이는 그룹 초대 코드 (그룹 밖 사람이 참여한 뒤 이 약속으로 오게)
  group: { id: string; name: string; inviteCode: string };
  creatorId: string;
  canEdit: boolean;
  canReopen: boolean;
  myStatus: ParticipantStatus | null;
  // 대기 중이면 1부터 시작하는 순번
  myWaitlistRank: number | null;
  // 각 목록은 상태가 바뀐 순서(대기는 대기 순번)대로 정렬돼 있다.
  participants: Record<ParticipantStatus, Participant[]>;
};

// DB 타입을 생성하지 않았으므로 응답 모양을 직접 적는다.
type EventRow = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  place_name: string | null;
  max_people: number | null;
  ended_at: string | null;
  end_reason: EndReason | null;
  end_note: string | null;
  creator: { id: string; nickname: string; avatar_url: string | null; avatar_color: AvatarColor } | null;
  event_comments: { user_id: string; created_at: string }[];
  // RLS로 내 기록만 온다.
  event_seen: { seen_at: string }[];
  event_participants: { status: ParticipantStatus }[];
};

type EventDetailRow = Omit<EventRow, "event_participants"> & {
  place_address: string | null;
  place_lat: number | null;
  place_lng: number | null;
  place_url: string | null;
  memo: string | null;
  created_by: string;
  groups: { id: string; name: string; owner_id: string; invite_code: string };
  event_participants: {
    status: ParticipantStatus;
    profiles: { id: string; nickname: string; avatar_url: string | null; avatar_color: AvatarColor } | null;
  }[];
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// event_participants 때문에 events→profiles 경로가 둘이라 만든 사람은 created_by로 지정한다.
const BASE_COLUMNS =
  "id, title, starts_at, ends_at, place_name, max_people, ended_at, end_reason, end_note, creator:profiles!created_by(id, nickname, avatar_url, avatar_color), event_comments(user_id, created_at), event_seen(seen_at)";

function toSummary(
  row: Omit<EventRow, "event_participants">,
  statuses: ParticipantStatus[],
  userId: string,
  // 내가 볼 수 있는 카톡 이름 (방장인 그룹의 멤버만, kakao-names.ts)
  kakaoNames: Map<string, string>,
): EventSummary {
  const goingCount = statuses.filter((status) => status === "going").length;
  const summary = {
    id: row.id,
    title: row.title,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    placeName: row.place_name,
    maxPeople: row.max_people,
    goingCount,
  };
  // 현재 시각이 필요하므로 렌더링이 아니라 데이터를 불러올 때 계산한다.
  const now = Date.now();
  return {
    ...summary,
    status: getEventStatus({ ...summary, endedAt: row.ended_at }, goingCount, now),
    endReason: getEndReason({ startsAt: row.starts_at, endsAt: row.ends_at, endReason: row.end_reason }, now),
    endNote: row.end_note,
    endedManually: row.ended_at !== null,
    daysLeft: daysUntil(row.starts_at, now) ?? (row.ends_at && Date.parse(row.ends_at) > now ? 0 : null),
    creator: row.creator
      ? {
          nickname: row.creator.nickname,
          kakaoName: kakaoNames.get(row.creator.id) ?? null,
          avatarUrl: row.creator.avatar_url,
          avatarColor: row.creator.avatar_color,
        }
      : null,
    otherCommentTimes: row.event_comments.filter((c) => c.user_id !== userId).map((c) => c.created_at),
    seenAt: row.event_seen[0]?.seen_at ?? null,
  };
}

// 기간 [from, to)에 걸치는 약속만 남긴다. 여러 날 약속은 시작이 from보다 앞서도 from 뒤에 끝나면 들어간다.
function overlapping<Q extends { or(filter: string): Q; lt(column: string, value: string): Q }>(
  query: Q,
  from?: Date,
  to?: Date,
) {
  let q = query;
  if (from) q = q.or(`starts_at.gte.${from.toISOString()},ends_at.gt.${from.toISOString()}`);
  if (to) q = q.lt("starts_at", to.toISOString());
  return q;
}

// 그룹 약속을 기간으로 조회한다. from 이상, to 미만. (기간에 걸치는 여러 날 약속 포함)
async function getGroupEvents(
  groupId: string,
  {
    from,
    to,
    finishedOnly = false,
    latestFirst = false,
    limit,
  }: {
    from?: Date;
    to?: Date;
    // 다 끝난 약속만 (진행 중인 여러 날 약속은 뺀다)
    finishedOnly?: boolean;
    latestFirst?: boolean;
    limit?: number;
  },
): Promise<EventSummary[]> {
  const [userId, kakaoNames] = await Promise.all([getUserId(), getVisibleKakaoNames()]);
  const supabase = await createClient();
  let query = supabase
    .from("events")
    .select(`${BASE_COLUMNS}, event_participants(status)`)
    .eq("group_id", groupId);
  query = overlapping(query, from, to);
  if (finishedOnly && to) query = query.or(`ends_at.is.null,ends_at.lte.${to.toISOString()}`);
  query = query.order("starts_at", { ascending: !latestFirst });
  if (limit) query = query.limit(limit);

  const { data, error } = await query.overrideTypes<EventRow[], { merge: false }>();
  if (error) throw new Error(`약속을 불러오지 못했어요. (${error.message})`);
  return data.map((row) =>
    toSummary(
      row,
      row.event_participants.map((p) => p.status),
      userId,
      kakaoNames,
    ),
  );
}

// 다가오는 약속. 가까운 순.
export function getUpcomingEvents(groupId: string) {
  return getGroupEvents(groupId, { from: new Date() });
}

// 지난 약속. 최근 순으로 30개까지.
export function getPastEvents(groupId: string) {
  return getGroupEvents(groupId, { to: new Date(), finishedOnly: true, latestFirst: true, limit: 30 });
}

// 캘린더 한 달 치. 지난 약속도 포함한다.
export function getEventsBetween(groupId: string, from: Date, to: Date) {
  return getGroupEvents(groupId, { from, to });
}

export type MyEvent = EventSummary & {
  group: { name: string; emoji: string };
  myStatus: "going" | "waitlisted";
};

// 모든 그룹에서 내가 참여·대기 중인 다가오는 약속. 가까운 순.
// 날짜가 남았어도 만든 사람이 일찍 종료한 약속은 뺀다. (그룹 화면과 캘린더에서는 회색으로 보인다)
export async function getMyUpcomingEvents(): Promise<MyEvent[]> {
  const [userId, kakaoNames] = await Promise.all([getUserId(), getVisibleKakaoNames()]);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .select(
      `${BASE_COLUMNS}, groups(name, emoji), event_participants(status),
       mine:event_participants!inner(user_id, status)`,
    )
    .eq("mine.user_id", userId)
    .in("mine.status", ["going", "waitlisted"])
    .or(`starts_at.gte.${new Date().toISOString()},ends_at.gt.${new Date().toISOString()}`)
    .is("ended_at", null)
    .order("starts_at")
    .overrideTypes<
      (EventRow & {
        groups: { name: string; emoji: string };
        mine: { status: "going" | "waitlisted" }[];
      })[],
      { merge: false }
    >();

  if (error) throw new Error(`내 약속을 불러오지 못했어요. (${error.message})`);
  return data.map((row) => ({
    ...toSummary(
      row,
      row.event_participants.map((p) => p.status),
      userId,
      kakaoNames,
    ),
    group: row.groups,
    myStatus: row.mine[0].status,
  }));
}

export type GroupedEvent = EventSummary & {
  group: { name: string; emoji: string; color: GroupColor };
};

// 한 달 동안 내가 참여·대기한 약속 (홈 캘린더). 모든 그룹을 모아 그룹 색으로 구분한다.
export async function getMyEventsBetween(from: Date, to: Date): Promise<GroupedEvent[]> {
  const [userId, kakaoNames] = await Promise.all([getUserId(), getVisibleKakaoNames()]);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .select(
      `${BASE_COLUMNS}, groups(name, emoji, color), event_participants(status),
       mine:event_participants!inner(user_id, status)`,
    )
    .eq("mine.user_id", userId)
    .in("mine.status", ["going", "waitlisted"])
    .or(`starts_at.gte.${from.toISOString()},ends_at.gt.${from.toISOString()}`)
    .lt("starts_at", to.toISOString())
    .order("starts_at")
    .overrideTypes<
      (EventRow & { groups: { name: string; emoji: string; color: GroupColor } })[],
      { merge: false }
    >();

  if (error) throw new Error(`약속을 불러오지 못했어요. (${error.message})`);
  return data.map((row) => ({
    ...toSummary(
      row,
      row.event_participants.map((p) => p.status),
      userId,
      kakaoNames,
    ),
    group: row.groups,
  }));
}

// 약속 상세. 그룹 멤버가 아니거나 없는 약속이면 null.
export async function getEvent(id: string): Promise<EventDetail | null> {
  if (!UUID.test(id)) return null;

  const supabase = await createClient();
  const [userId, kakaoNames, { data: row }] = await Promise.all([
    getUserId(),
    getVisibleKakaoNames(),
    supabase
      .from("events")
      .select(
        `${BASE_COLUMNS}, place_address, place_lat, place_lng, place_url, memo, created_by, groups(id, name, owner_id, invite_code),
         event_participants(status, updated_at, profiles(id, nickname, avatar_url, avatar_color))`,
      )
      .eq("id", id)
      .order("updated_at", { referencedTable: "event_participants" })
      .maybeSingle()
      .overrideTypes<EventDetailRow, { merge: false }>(),
  ]);

  if (!row) return null;

  const canEdit = row.created_by === userId || row.groups.owner_id === userId;

  const participants: EventDetail["participants"] = {
    going: [],
    waitlisted: [],
    maybe: [],
    not_going: [],
  };
  let myStatus: ParticipantStatus | null = null;
  for (const { status, profiles: profile } of row.event_participants) {
    if (!profile) continue;
    if (profile.id === userId) myStatus = status;
    participants[status].push({
      id: profile.id,
      nickname: profile.nickname,
      kakaoName: kakaoNames.get(profile.id) ?? null,
      avatarUrl: profile.avatar_url,
      avatarColor: profile.avatar_color,
    });
  }

  return {
    ...toSummary(
      row,
      row.event_participants.map((p) => p.status),
      userId,
      kakaoNames,
    ),
    place:
      row.place_lat !== null && row.place_lng !== null && row.place_url
        ? {
            address: row.place_address,
            lat: row.place_lat,
            lng: row.place_lng,
            url: row.place_url,
          }
        : null,
    memo: row.memo,
    group: { id: row.groups.id, name: row.groups.name, inviteCode: row.groups.invite_code },
    creatorId: row.created_by,
    canEdit,
    // 직접 종료했고 아직 시작 전이면 다시 열 수 있다.
    canReopen: canEdit && row.ended_at !== null && new Date(row.starts_at).getTime() > Date.now(),
    myStatus,
    myWaitlistRank:
      myStatus === "waitlisted"
        ? participants.waitlisted.findIndex((p) => p.id === userId) + 1
        : null,
    participants,
  };
}
