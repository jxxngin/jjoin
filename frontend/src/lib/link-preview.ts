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

// 날짜 투표 링크(/polls/id) 미리보기: 제목, 종류(당일·기간), 후보 수, 그룹
export async function getPollPreview(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await createAdminClient()
    .from("date_polls")
    .select("title, kind, groups(name, emoji), date_poll_options(id)")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const row = data as unknown as {
    title: string;
    kind: "day" | "trip";
    groups: { name: string; emoji: string };
    date_poll_options: { id: string }[];
  };
  return {
    title: row.title,
    kindLabel: row.kind === "trip" ? "🧳 기간 투표" : "⏰ 당일 투표",
    optionCount: row.date_poll_options.length,
    group: row.groups,
  };
}
