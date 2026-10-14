import "server-only";
import type { AvatarColor } from "@/lib/avatar-style";
import type { GroupColor } from "@/lib/group-style";
import { getUserId } from "@/lib/auth";
import { formatDday } from "@/lib/datetime";
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
  placeName: string | null;
  maxPeople: number | null;
  goingCount: number;
  status: EventStatus;
  // 종료된 약속만 있다. 시간이 지나 끝났으면 time_passed
  endReason: EndReason | null;
  endNote: string | null;
  // 만든 사람·방장이 직접 종료했는지 (다시 열 수 있는지 판단)
  endedManually: boolean;
  // "D-3", "D-Day". 지난 약속이면 null
  dday: string | null;
  creator: Person | null;
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
  group: { id: string; name: string };
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
  place_name: string | null;
  max_people: number | null;
  ended_at: string | null;
  end_reason: EndReason | null;
  end_note: string | null;
  creator: { nickname: string; kakao_name: string | null; avatar_url: string | null; avatar_color: AvatarColor } | null;
  event_participants: { status: ParticipantStatus }[];
};

type EventDetailRow = Omit<EventRow, "event_participants"> & {
  place_address: string | null;
  place_lat: number | null;
  place_lng: number | null;
  place_url: string | null;
  memo: string | null;
  created_by: string;
  groups: { id: string; name: string; owner_id: string };
  event_participants: {
    status: ParticipantStatus;
    profiles: { id: string; nickname: string; kakao_name: string | null; avatar_url: string | null; avatar_color: AvatarColor } | null;
  }[];
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// event_participants 때문에 events→profiles 경로가 둘이라 만든 사람은 created_by로 지정한다.
const BASE_COLUMNS =
  "id, title, starts_at, place_name, max_people, ended_at, end_reason, end_note, creator:profiles!created_by(nickname, kakao_name, avatar_url, avatar_color)";

function toSummary(
  row: Omit<EventRow, "event_participants">,
  statuses: ParticipantStatus[],
): EventSummary {
  const goingCount = statuses.filter((status) => status === "going").length;
  const summary = {
    id: row.id,
    title: row.title,
    startsAt: row.starts_at,
    placeName: row.place_name,
    maxPeople: row.max_people,
    goingCount,
  };
  // 현재 시각이 필요하므로 렌더링이 아니라 데이터를 불러올 때 계산한다.
  const now = Date.now();
  return {
    ...summary,
    status: getEventStatus({ ...summary, endedAt: row.ended_at }, goingCount, now),
    endReason: getEndReason({ startsAt: row.starts_at, endReason: row.end_reason }, now),
    endNote: row.end_note,
    endedManually: row.ended_at !== null,
    dday: formatDday(row.starts_at, now),
    creator: row.creator
      ? {
          nickname: row.creator.nickname,
          kakaoName: row.creator.kakao_name,
          avatarUrl: row.creator.avatar_url,
          avatarColor: row.creator.avatar_color,
        }
      : null,
  };
}

// 그룹 약속을 기간으로 조회한다. from 이상, to 미만.
async function getGroupEvents(
  groupId: string,
  { from, to, latestFirst = false, limit }: { from?: Date; to?: Date; latestFirst?: boolean; limit?: number },
): Promise<EventSummary[]> {
  const supabase = await createClient();
  let query = supabase
    .from("events")
    .select(`${BASE_COLUMNS}, event_participants(status)`)
    .eq("group_id", groupId);
  if (from) query = query.gte("starts_at", from.toISOString());
  if (to) query = query.lt("starts_at", to.toISOString());
  query = query.order("starts_at", { ascending: !latestFirst });
  if (limit) query = query.limit(limit);

  const { data, error } = await query.overrideTypes<EventRow[], { merge: false }>();
  if (error) throw new Error(`약속을 불러오지 못했어요. (${error.message})`);
  return data.map((row) =>
    toSummary(
      row,
      row.event_participants.map((p) => p.status),
    ),
  );
}

// 다가오는 약속. 가까운 순.
export function getUpcomingEvents(groupId: string) {
  return getGroupEvents(groupId, { from: new Date() });
}

// 지난 약속. 최근 순으로 30개까지.
export function getPastEvents(groupId: string) {
  return getGroupEvents(groupId, { to: new Date(), latestFirst: true, limit: 30 });
}

// 캘린더 한 달 치. 지난 약속도 포함한다.
export function getEventsBetween(groupId: string, from: Date, to: Date) {
  return getGroupEvents(groupId, { from, to });
}

export type MyEvent = EventSummary & {
  groupName: string;
  myStatus: "going" | "waitlisted";
};

// 모든 그룹에서 내가 참여·대기 중인 다가오는 약속. 가까운 순.
export async function getMyUpcomingEvents(): Promise<MyEvent[]> {
  const userId = await getUserId();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .select(
      `${BASE_COLUMNS}, groups(name), event_participants(status),
       mine:event_participants!inner(user_id, status)`,
    )
    .eq("mine.user_id", userId)
    .in("mine.status", ["going", "waitlisted"])
    .gte("starts_at", new Date().toISOString())
    .order("starts_at")
    .overrideTypes<
      (EventRow & {
        groups: { name: string };
        mine: { status: "going" | "waitlisted" }[];
      })[],
      { merge: false }
    >();

  if (error) throw new Error(`내 약속을 불러오지 못했어요. (${error.message})`);
  return data.map((row) => ({
    ...toSummary(
      row,
      row.event_participants.map((p) => p.status),
    ),
    groupName: row.groups.name,
    myStatus: row.mine[0].status,
  }));
}

export type GroupedEvent = EventSummary & {
  group: { name: string; emoji: string; color: GroupColor };
};

// 한 달 동안 내가 참여·대기한 약속 (홈 캘린더). 모든 그룹을 모아 그룹 색으로 구분한다.
export async function getMyEventsBetween(from: Date, to: Date): Promise<GroupedEvent[]> {
  const userId = await getUserId();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .select(
      `${BASE_COLUMNS}, groups(name, emoji, color), event_participants(status),
       mine:event_participants!inner(user_id, status)`,
    )
    .eq("mine.user_id", userId)
    .in("mine.status", ["going", "waitlisted"])
    .gte("starts_at", from.toISOString())
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
    ),
    group: row.groups,
  }));
}

// 약속 상세. 그룹 멤버가 아니거나 없는 약속이면 null.
export async function getEvent(id: string): Promise<EventDetail | null> {
  if (!UUID.test(id)) return null;

  const supabase = await createClient();
  const [userId, { data: row }] = await Promise.all([
    getUserId(),
    supabase
      .from("events")
      .select(
        `${BASE_COLUMNS}, place_address, place_lat, place_lng, place_url, memo, created_by, groups(id, name, owner_id),
         event_participants(status, updated_at, profiles(id, nickname, kakao_name, avatar_url, avatar_color))`,
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
      kakaoName: profile.kakao_name,
      avatarUrl: profile.avatar_url,
      avatarColor: profile.avatar_color,
    });
  }

  return {
    ...toSummary(
      row,
      row.event_participants.map((p) => p.status),
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
    group: { id: row.groups.id, name: row.groups.name },
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
