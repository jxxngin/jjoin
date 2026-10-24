import "server-only";
import { formatEventPeriod } from "@/lib/datetime";
import { createAdminClient } from "@/lib/supabase/admin";

// 링크 미리보기에 보여 줄 만큼만 읽는다. 초대 코드나 약속 id를 아는 사람에게만 보이는 정보다.
export async function getInvitePreview(code: string) {
  const { data } = await createAdminClient()
    .from("groups")
    .select("name, emoji, description")
    .eq("invite_code", code)
    .maybeSingle();
  return data as { name: string; emoji: string; description: string | null } | null;
}

export async function getEventPreview(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await createAdminClient()
    .from("events")
    .select("title, starts_at, ends_at, place_name, groups(name, emoji)")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const row = data as unknown as {
    title: string;
    starts_at: string;
    ends_at: string | null;
    place_name: string | null;
    groups: { name: string; emoji: string };
  };
  return {
    title: row.title,
    when: formatEventPeriod(row.starts_at, row.ends_at),
    place: row.place_name,
    group: row.groups,
  };
}
