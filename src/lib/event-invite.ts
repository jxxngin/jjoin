import "server-only";
import { getInvite, type Invite } from "@/lib/groups";
import { createAdminClient } from "@/lib/supabase/admin";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type EventInvite = Invite & {
  event: { title: string; startsAt: string; endsAt: string | null };
};

// 약속 공유 링크(/events/<id>?invite=<코드>)로 그룹 밖 사람이 들어왔을 때 보여 줄 정보.
// 초대 코드가 정말 그 약속이 속한 그룹의 것일 때만 돌려준다. (남의 코드로 다른 약속을 엿보지 못하게)
// 멤버가 아니면 RLS 때문에 약속을 못 읽으므로, 제목·날짜·그룹만 서버 비밀 키로 읽는다. (카톡 미리보기와 같은 범위)
export async function getEventInvite(eventId: string, code: string): Promise<EventInvite | null> {
  if (!UUID.test(eventId) || !code) return null;

  const [invite, { data: event }] = await Promise.all([
    getInvite(code),
    createAdminClient().from("events").select("group_id, title, starts_at, ends_at").eq("id", eventId).maybeSingle(),
  ]);
  if (!invite || !event || event.group_id !== invite.groupId) return null;

  return {
    ...invite,
    event: { title: event.title, startsAt: event.starts_at, endsAt: event.ends_at },
  };
}
