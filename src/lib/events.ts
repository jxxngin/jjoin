import "server-only";
import { getUserId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type EventSummary = {
  id: string;
  title: string;
  startsAt: string;
  placeName: string | null;
  minPeople: number | null;
  maxPeople: number | null;
};

export type EventDetail = EventSummary & {
  memo: string | null;
  group: { id: string; name: string };
  creator: { nickname: string; avatarUrl: string | null } | null;
  canEdit: boolean;
};

// DB 타입을 생성하지 않았으므로 응답 모양을 직접 적는다.
type EventRow = {
  id: string;
  title: string;
  starts_at: string;
  place_name: string | null;
  min_people: number | null;
  max_people: number | null;
};

type EventDetailRow = EventRow & {
  memo: string | null;
  created_by: string;
  groups: { id: string; name: string; owner_id: string };
  profiles: { nickname: string; avatar_url: string | null } | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SUMMARY_COLUMNS = "id, title, starts_at, place_name, min_people, max_people";

function toSummary(row: EventRow): EventSummary {
  return {
    id: row.id,
    title: row.title,
    startsAt: row.starts_at,
    placeName: row.place_name,
    minPeople: row.min_people,
    maxPeople: row.max_people,
  };
}

// 그룹의 다가오는 약속. 가까운 순.
export async function getUpcomingEvents(groupId: string): Promise<EventSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .select(SUMMARY_COLUMNS)
    .eq("group_id", groupId)
    .gte("starts_at", new Date().toISOString())
    .order("starts_at")
    .overrideTypes<EventRow[], { merge: false }>();

  if (error) throw new Error(`약속을 불러오지 못했어요. (${error.message})`);
  return data.map(toSummary);
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
        `${SUMMARY_COLUMNS}, memo, created_by, groups(id, name, owner_id), profiles(nickname, avatar_url)`,
      )
      .eq("id", id)
      .maybeSingle()
      .overrideTypes<EventDetailRow, { merge: false }>(),
  ]);

  if (!row) return null;

  return {
    ...toSummary(row),
    memo: row.memo,
    group: { id: row.groups.id, name: row.groups.name },
    creator: row.profiles
      ? { nickname: row.profiles.nickname, avatarUrl: row.profiles.avatar_url }
      : null,
    canEdit: row.created_by === userId || row.groups.owner_id === userId,
  };
}
