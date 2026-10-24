import "server-only";
import { formatRelative } from "@/lib/datetime";
import { createClient } from "@/lib/supabase/server";

export type InquiryCategory = "bug" | "feature" | "usage" | "account" | "other";
export type InquiryStatus = "received" | "in_progress" | "done";

export const INQUIRY_CATEGORIES: { value: InquiryCategory; icon: string; label: string; hint: string }[] = [
  { value: "bug", icon: "🐞", label: "오류 신고", hint: "안 돼요, 이상해요" },
  { value: "feature", icon: "💡", label: "기능 제안", hint: "이런 게 있으면 좋겠어요" },
  { value: "usage", icon: "❓", label: "이용 문의", hint: "어떻게 쓰는지 궁금해요" },
  { value: "account", icon: "👤", label: "계정·개인정보", hint: "로그인, 탈퇴, 정보" },
  { value: "other", icon: "💬", label: "기타", hint: "그 밖의 이야기" },
];

export const INQUIRY_STATUS: Record<InquiryStatus, { label: string; className: string }> = {
  received: { label: "접수", className: "bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300" },
  in_progress: { label: "확인 중", className: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
  done: { label: "처리 완료", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
};

export function categoryOf(value: InquiryCategory) {
  return INQUIRY_CATEGORIES.find((c) => c.value === value) ?? INQUIRY_CATEGORIES[4];
}

export type Inquiry = {
  id: string;
  category: InquiryCategory;
  title: string;
  body: string;
  pagePath: string | null;
  userAgent: string | null;
  status: InquiryStatus;
  reply: string | null;
  repliedAt: string | null;
  createdAt: string;
  timeLabel: string;
  author: { id: string; nickname: string } | null;
  autoFixStatus: "pending" | "pr_opened" | "failed" | "skipped" | null;
  autoFixUrl: string | null;
};

type Row = {
  id: string;
  category: InquiryCategory;
  title: string;
  body: string;
  page_path: string | null;
  user_agent: string | null;
  status: InquiryStatus;
  reply: string | null;
  replied_at: string | null;
  created_at: string;
  auto_fix_status: Inquiry["autoFixStatus"];
  auto_fix_url: string | null;
  profiles: { id: string; nickname: string } | null;
};

const COLUMNS =
  "id, category, title, body, page_path, user_agent, status, reply, replied_at, created_at, auto_fix_status, auto_fix_url, profiles(id, nickname)";

function toInquiry(row: Row, now: number): Inquiry {
  return {
    id: row.id,
    category: row.category,
    title: row.title,
    body: row.body,
    pagePath: row.page_path,
    userAgent: row.user_agent,
    status: row.status,
    reply: row.reply,
    repliedAt: row.replied_at,
    createdAt: row.created_at,
    timeLabel: formatRelative(row.created_at, now),
    author: row.profiles,
    autoFixStatus: row.auto_fix_status,
    autoFixUrl: row.auto_fix_url,
  };
}

// 관리자인지 (app_admins에 있는지)
export async function isAppAdmin() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("is_app_admin");
  return data === true;
}

// 문의 목록. mine이면 내 문의만, 아니면 (관리자에게) 전체. 최신 순.
export async function getInquiries({ mine, status }: { mine: boolean; status?: InquiryStatus }): Promise<Inquiry[]> {
  const supabase = await createClient();
  let query = supabase.from("inquiries").select(COLUMNS).order("created_at", { ascending: false }).limit(100);
  if (mine) {
    const { data: auth } = await supabase.auth.getUser();
    query = query.eq("user_id", auth.user?.id ?? "");
  }
  if (status) query = query.eq("status", status);
  const { data, error } = await query.overrideTypes<Row[], { merge: false }>();
  if (error) throw new Error(`문의를 불러오지 못했어요. (${error.message})`);
  // 현재 시각이 필요하므로 렌더링이 아니라 데이터를 불러올 때 계산한다.
  const now = Date.now();
  return data.map((row) => toInquiry(row, now));
}

// 문의 하나. 본인이나 관리자가 아니면 RLS 때문에 null.
export async function getInquiry(id: string): Promise<Inquiry | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("inquiries")
    .select(COLUMNS)
    .eq("id", id)
    .maybeSingle()
    .overrideTypes<Row, { merge: false }>();
  return data ? toInquiry(data, Date.now()) : null;
}

// 관리자 머리글 배지: 아직 손대지 않은(접수) 문의 수. 관리자가 아니면 null.
export async function getAdminInquiryBadge(): Promise<number | null> {
  if (!(await isAppAdmin())) return null;
  const supabase = await createClient();
  const { count } = await supabase
    .from("inquiries")
    .select("id", { count: "exact", head: true })
    .eq("status", "received");
  return count ?? 0;
}
