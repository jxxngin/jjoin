import "server-only";
import { getUserId } from "@/lib/auth";
import { getEventStatus, type EventStatus, type ParticipantStatus } from "@/lib/event-status";
import { createClient } from "@/lib/supabase/server";

export type EventSummary = {
  id: string;
  title: string;
  startsAt: string;
  placeName: string | null;
  minPeople: number | null;
  maxPeople: number | null;
  goingCount: number;
  status: EventStatus;
};

export type Participant = {
  id: string;
  nickname: string;
  avatarUrl: string | null;
};

export type EventDetail = EventSummary & {
  memo: string | null;
  group: { id: string; name: string };
  creator: { nickname: string; avatarUrl: string | null } | null;
  canEdit: boolean;
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
  min_people: number | null;
  max_people: number | null;
  event_participants: { status: ParticipantStatus }[];
};

type EventDetailRow = Omit<EventRow, "event_participants"> & {
  memo: string | null;
  created_by: string;
  groups: { id: string; name: string; owner_id: string };
  creator: { nickname: string; avatar_url: string | null } | null;
  event_participants: {
    status: ParticipantStatus;
    profiles: { id: string; nickname: string; avatar_url: string | null } | null;
  }[];
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const BASE_COLUMNS = "id, title, starts_at, place_name, min_people, max_people";

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
    minPeople: row.min_people,
    maxPeople: row.max_people,
    goingCount,
  };
  // 현재 시각이 필요하므로 렌더링이 아니라 데이터를 불러올 때 계산한다.
  return { ...summary, status: getEventStatus(summary, goingCount, Date.now()) };
}

// 그룹의 다가오는 약속. 가까운 순.
export async function getUpcomingEvents(groupId: string): Promise<EventSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .select(`${BASE_COLUMNS}, event_participants(status)`)
    .eq("group_id", groupId)
    .gte("starts_at", new Date().toISOString())
    .order("starts_at")
    .overrideTypes<EventRow[], { merge: false }>();

  if (error) throw new Error(`약속을 불러오지 못했어요. (${error.message})`);
  return data.map((row) =>
    toSummary(
      row,
      row.event_participants.map((p) => p.status),
    ),
  );
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
        `${BASE_COLUMNS}, memo, created_by, groups(id, name, owner_id), creator:profiles!created_by(nickname, avatar_url),
         event_participants(status, updated_at, profiles(id, nickname, avatar_url))`,
      )
      .eq("id", id)
      .order("updated_at", { referencedTable: "event_participants" })
      .maybeSingle()
      .overrideTypes<EventDetailRow, { merge: false }>(),
  ]);

  if (!row) return null;

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
      avatarUrl: profile.avatar_url,
    });
  }

  return {
    ...toSummary(
      row,
      row.event_participants.map((p) => p.status),
    ),
    memo: row.memo,
    group: { id: row.groups.id, name: row.groups.name },
    creator: row.creator
      ? { nickname: row.creator.nickname, avatarUrl: row.creator.avatar_url }
      : null,
    canEdit: row.created_by === userId || row.groups.owner_id === userId,
    myStatus,
    myWaitlistRank:
      myStatus === "waitlisted"
        ? participants.waitlisted.findIndex((p) => p.id === userId) + 1
        : null,
    participants,
  };
}
