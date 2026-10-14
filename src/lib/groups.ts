import "server-only";
import type { AvatarColor } from "@/lib/avatar-style";
import type { GroupColor } from "@/lib/group-style";
import { getUserId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// 그룹 꾸미기 (0009_group_profile.sql)
export type GroupProfile = {
  emoji: string;
  color: GroupColor;
  description: string | null;
};

export type GroupSummary = GroupProfile & {
  id: string;
  name: string;
  memberCount: number;
  // 다른 멤버가 약속을 올리거나 고친 시각, 댓글을 단 시각 중 가장 최근. 홈의 "새 소식" 테두리에 쓴다.
  latestActivityAt: string | null;
};

export type GroupMember = {
  id: string;
  nickname: string;
  kakaoName: string | null;
  avatarUrl: string | null;
  avatarColor: AvatarColor;
  role: "owner" | "member";
};

export type GroupDetail = GroupProfile & {
  id: string;
  name: string;
  inviteCode: string;
  ownerId: string;
  members: GroupMember[];
};

export type Invite = GroupProfile & {
  groupId: string;
  groupName: string;
  memberCount: number;
  isMember: boolean;
};

// DB 타입을 생성하지 않았으므로 응답 모양을 직접 적는다.
type GroupRow = {
  id: string;
  name: string;
  invite_code: string;
  emoji: string;
  color: GroupColor;
  description: string | null;
  owner_id: string;
  group_members: {
    role: string;
    joined_at: string;
    profiles: { id: string; nickname: string; kakao_name: string | null; avatar_url: string | null; avatar_color: AvatarColor } | null;
  }[];
};

type InviteRow = {
  group_id: string;
  group_name: string;
  group_emoji: string;
  group_color: GroupColor;
  group_description: string | null;
  member_count: number;
  is_member: boolean;
};

const UUID =/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 내가 속한 그룹. RLS가 멤버인 그룹만 돌려준다.
type ActivityRow = {
  created_by: string;
  updated_at: string;
  event_comments: { user_id: string; created_at: string }[];
};

// 내 활동은 빼고, 다른 멤버의 약속·댓글 중 가장 최근 시각
function latestActivityBy(others: (userId: string) => boolean, events: ActivityRow[]) {
  const times = events.flatMap((event) => [
    ...(others(event.created_by) ? [event.updated_at] : []),
    ...event.event_comments.filter((c) => others(c.user_id)).map((c) => c.created_at),
  ]);
  if (times.length === 0) return null;
  return times.reduce((latest, time) => (Date.parse(time) > Date.parse(latest) ? time : latest));
}

export async function getMyGroups(): Promise<GroupSummary[]> {
  const userId = await getUserId();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("groups")
    .select(
      "id, name, emoji, color, description, group_members(count), activity:events(created_by, updated_at, event_comments(user_id, created_at))",
    )
    // 약속마다 최근 댓글 몇 개만 보면 충분하다.
    .order("created_at", { referencedTable: "activity.event_comments", ascending: false })
    .limit(5, { referencedTable: "activity.event_comments" })
    .order("created_at", { ascending: false });

  if (error) throw new Error(`그룹을 불러오지 못했어요. (${error.message})`);

  const others = (id: string) => id !== userId;
  return data.map((group) => ({
    id: group.id,
    name: group.name,
    emoji: group.emoji,
    color: group.color,
    description: group.description,
    memberCount: group.group_members[0]?.count ?? 0,
    latestActivityAt: latestActivityBy(others, group.activity as ActivityRow[]),
  }));
}

// 그룹 상세. 멤버가 아니거나 없는 그룹이면 null.
export async function getGroup(id: string): Promise<GroupDetail | null> {
  if (!UUID.test(id)) return null;

  const supabase = await createClient();
  const { data: group } = await supabase
    .from("groups")
    .select(
      "id, name, invite_code, owner_id, emoji, color, description, group_members(role, joined_at, profiles(id, nickname, kakao_name, avatar_url, avatar_color))",
    )
    .eq("id", id)
    .order("joined_at", { referencedTable: "group_members" })
    .maybeSingle()
    .overrideTypes<GroupRow, { merge: false }>();

  if (!group) return null;

  return {
    id: group.id,
    name: group.name,
    emoji: group.emoji,
    color: group.color,
    description: group.description,
    inviteCode: group.invite_code,
    ownerId: group.owner_id,
    members: group.group_members.flatMap(({ role, profiles: profile }) =>
      profile
        ? [
            {
              id: profile.id,
              nickname: profile.nickname,
              kakaoName: profile.kakao_name,
              avatarUrl: profile.avatar_url,
              avatarColor: profile.avatar_color,
              role: role as GroupMember["role"],
            },
          ]
        : [],
    ),
  };
}

// 초대 코드로 그룹 미리보기. 잘못된 코드면 null.
export async function getInvite(code: string): Promise<Invite | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .rpc("get_invite", { code })
    .maybeSingle()
    .overrideTypes<InviteRow, { merge: false }>();
  if (!data) return null;

  return {
    groupId: data.group_id,
    groupName: data.group_name,
    emoji: data.group_emoji,
    color: data.group_color,
    description: data.group_description,
    memberCount: Number(data.member_count),
    isMember: data.is_member,
  };
}
