import "server-only";
import { getUserId } from "@/lib/auth";
import type { AvatarColor } from "@/lib/avatar-style";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// day: 당일 투표 (후보 = 날짜와 시간), trip: 기간 투표 (후보 = 가는 날~오는 날, 출발 시간은 모두 같다)
export type PollKind = "day" | "trip";

export type Voter = { id: string; nickname: string; avatarUrl: string | null; avatarColor: AvatarColor };

export type PollOption = {
  id: string;
  startsAt: string;
  // 기간 투표 후보가 끝나는 시각 (마지막 날 다음 날 0시). 당일 투표면 null
  endsAt: string | null;
  voters: Voter[];
  votedByMe: boolean;
};

export type PollDetail = {
  id: string;
  kind: PollKind;
  title: string;
  placeName: string | null;
  maxPeople: number | null;
  memo: string | null;
  closed: boolean;
  eventId: string | null;
  // inviteCode: 투표 공유 링크에 붙이는 그룹 초대 코드 (그룹 밖 사람이 참여한 뒤 이 투표로 오게)
  group: { id: string; name: string; inviteCode: string };
  canManage: boolean;
  // 날짜 순
  options: PollOption[];
  // 한 번이라도 투표한 사람 수
  voterCount: number;
};

export type PollSummary = {
  id: string;
  kind: PollKind;
  title: string;
  closed: boolean;
  optionCount: number;
  voterCount: number;
};

type PollRow = {
  id: string;
  kind: PollKind;
  title: string;
  place_name: string | null;
  max_people: number | null;
  memo: string | null;
  created_by: string;
  closed_at: string | null;
  event_id: string | null;
  groups: { id: string; name: string; owner_id: string; invite_code: string };
  date_poll_options: {
    id: string;
    starts_at: string;
    ends_at: string | null;
    date_poll_votes: {
      user_id: string;
      profiles: { nickname: string; avatar_url: string | null; avatar_color: AvatarColor } | null;
    }[];
  }[];
};

// 그룹 화면에 보여 줄 투표: 아직 약속으로 확정되지 않은 것만. 최신 순.
export async function getGroupPolls(groupId: string): Promise<PollSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("date_polls")
    .select("id, kind, title, closed_at, date_poll_options(id, date_poll_votes(user_id))")
    .eq("group_id", groupId)
    .is("event_id", null)
    .order("created_at", { ascending: false })
    .overrideTypes<
      {
        id: string;
        kind: PollKind;
        title: string;
        closed_at: string | null;
        date_poll_options: { id: string; date_poll_votes: { user_id: string }[] }[];
      }[],
      { merge: false }
    >();

  if (error) throw new Error(`날짜 투표를 불러오지 못했어요. (${error.message})`);

  return data.map((poll) => ({
    id: poll.id,
    kind: poll.kind,
    title: poll.title,
    closed: poll.closed_at !== null,
    optionCount: poll.date_poll_options.length,
    voterCount: new Set(poll.date_poll_options.flatMap((o) => o.date_poll_votes.map((v) => v.user_id))).size,
  }));
}

// 투표 상세. 그룹 멤버가 아니거나 없는 투표면 null.
export async function getPoll(id: string): Promise<PollDetail | null> {
  if (!UUID.test(id)) return null;

  const supabase = await createClient();
  const [userId, { data: row }] = await Promise.all([
    getUserId(),
    supabase
      .from("date_polls")
      .select(
        `id, kind, title, place_name, max_people, memo, created_by, closed_at, event_id, groups(id, name, owner_id, invite_code),
         date_poll_options(id, starts_at, ends_at, date_poll_votes(user_id, profiles(nickname, avatar_url, avatar_color)))`,
      )
      .eq("id", id)
      .order("starts_at", { referencedTable: "date_poll_options" })
      .maybeSingle()
      .overrideTypes<PollRow, { merge: false }>(),
  ]);

  if (!row) return null;

  const options = row.date_poll_options.map((option) => ({
    id: option.id,
    startsAt: option.starts_at,
    endsAt: option.ends_at,
    votedByMe: option.date_poll_votes.some((v) => v.user_id === userId),
    voters: option.date_poll_votes.flatMap((v) =>
      v.profiles
        ? [
            {
              id: v.user_id,
              nickname: v.profiles.nickname,
              avatarUrl: v.profiles.avatar_url,
              avatarColor: v.profiles.avatar_color,
            },
          ]
        : [],
    ),
  }));

  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    placeName: row.place_name,
    maxPeople: row.max_people,
    memo: row.memo,
    closed: row.closed_at !== null,
    eventId: row.event_id,
    group: { id: row.groups.id, name: row.groups.name, inviteCode: row.groups.invite_code },
    canManage: row.created_by === userId || row.groups.owner_id === userId,
    options,
    voterCount: new Set(options.flatMap((o) => o.voters.map((v) => v.id))).size,
  };
}

// 마감 결과: 표가 많은 순, 같으면 이른 날짜 순으로 상위 3개. 표가 없는 날짜는 뺀다.
export function topOptions(options: PollOption[], count = 3) {
  return [...options]
    .filter((option) => option.voters.length > 0)
    .sort((a, b) => b.voters.length - a.voters.length || Date.parse(a.startsAt) - Date.parse(b.startsAt))
    .slice(0, count);
}
