import "server-only";
import { formatRelative } from "@/lib/datetime";
import { createClient } from "@/lib/supabase/server";

export type ClientErrorGroup = {
  message: string;
  count: number;
  people: number;
  lastLabel: string;
  lastPath: string | null;
  lastUserAgent: string | null;
  stack: string | null;
};

// 관리자: 최근 7일 화면 오류를 같은 메시지끼리 묶는다. 많이 난 순. (관리자가 아니면 RLS 때문에 빈 목록)
export async function getClientErrorGroups(): Promise<ClientErrorGroup[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("client_errors")
    .select("message, stack, page_path, user_agent, user_id, created_at")
    .gt("created_at", new Date(Date.now() - 7 * 864e5).toISOString())
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(`오류 기록을 불러오지 못했어요. (${error.message})`);

  const now = Date.now();
  const groups = new Map<string, ClientErrorGroup & { users: Set<string> }>();
  for (const row of data) {
    const group = groups.get(row.message);
    if (group) {
      group.count++;
      if (row.user_id) group.users.add(row.user_id);
      continue;
    }
    // 최신 순으로 읽으므로 처음 만난 행이 마지막으로 난 오류다.
    groups.set(row.message, {
      message: row.message,
      count: 1,
      people: 0,
      users: new Set(row.user_id ? [row.user_id] : []),
      lastLabel: formatRelative(row.created_at, now),
      lastPath: row.page_path,
      lastUserAgent: row.user_agent,
      stack: row.stack,
    });
  }
  return [...groups.values()]
    .map(({ users, ...group }) => ({ ...group, people: users.size }))
    .sort((a, b) => b.count - a.count);
}
