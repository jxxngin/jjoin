import "server-only";
import { backendError, backendFetch, inquiriesOnSpring } from "@/lib/backend-api";
import { formatRelative } from "@/lib/datetime";
import { createClient } from "@/lib/supabase/server";

export type InquiryCategory = "bug" | "feature" | "usage" | "account" | "other";
export type InquiryStatus = "received" | "in_progress" | "on_hold" | "done";
export type InquiryPriority = "urgent" | "normal";
export type AutoFixStatus = "pending" | "pr_opened" | "failed" | "skipped" | "capped";

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
  on_hold: { label: "보류", className: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300" },
  done: { label: "처리 완료", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
};

export function categoryOf(value: InquiryCategory) {
  return INQUIRY_CATEGORIES.find((c) => c.value === value) ?? INQUIRY_CATEGORIES[4];
}

export type InquiryMessage = {
  id: string;
  body: string;
  isAdmin: boolean;
  createdAt: string;
  // 관리자 글이 아니면 쓴 사람 (탈퇴했으면 null)
  author: { id: string; nickname: string } | null;
};

export type Inquiry = {
  id: string;
  category: InquiryCategory;
  title: string;
  body: string;
  pagePath: string | null;
  userAgent: string | null;
  status: InquiryStatus;
  priority: InquiryPriority;
  createdAt: string;
  timeLabel: string;
  // 들어온 지 며칠 (관리자 목록의 N일째)
  ageDays: number;
  author: { id: string; nickname: string } | null;
  autoFixStatus: AutoFixStatus | null;
  autoFixUrl: string | null;
  duplicateOf: string | null;
  images: string[];
  // 대화 (오래된 순)
  messages: InquiryMessage[];
  // 마지막 글이 관리자 답변인지 / 문의한 사람의 글인지 (목록 배지)
  answered: boolean;
  waitingAdmin: boolean;
};

type Row = {
  id: string;
  category: InquiryCategory;
  title: string;
  body: string;
  page_path: string | null;
  user_agent: string | null;
  status: InquiryStatus;
  priority: InquiryPriority;
  created_at: string;
  auto_fix_status: AutoFixStatus | null;
  auto_fix_url: string | null;
  duplicate_of: string | null;
  images: string[];
  profiles: { id: string; nickname: string } | null;
  inquiry_messages: {
    id: string;
    body: string;
    is_admin: boolean;
    created_at: string;
    profiles: { id: string; nickname: string } | null;
  }[];
};

// Spring 문의 API의 응답 (backend/.../InquiryService.Inquiry)
type ApiPerson = { id: string; nickname: string } | null;
type ApiInquiry = {
  id: string;
  category: InquiryCategory;
  title: string;
  body: string;
  pagePath: string | null;
  userAgent: string | null;
  status: InquiryStatus;
  priority: InquiryPriority;
  createdAt: string;
  autoFixStatus: AutoFixStatus | null;
  autoFixUrl: string | null;
  duplicateOf: string | null;
  images: string[];
  author: ApiPerson;
  messages: { id: string; body: string; isAdmin: boolean; createdAt: string; author: ApiPerson }[];
};

function fromApi(a: ApiInquiry): Row {
  return {
    id: a.id,
    category: a.category,
    title: a.title,
    body: a.body,
    page_path: a.pagePath,
    user_agent: a.userAgent,
    status: a.status,
    priority: a.priority,
    created_at: a.createdAt,
    auto_fix_status: a.autoFixStatus,
    auto_fix_url: a.autoFixUrl,
    duplicate_of: a.duplicateOf,
    images: a.images,
    profiles: a.author,
    inquiry_messages: a.messages.map((m) => ({
      id: m.id,
      body: m.body,
      is_admin: m.isAdmin,
      created_at: m.createdAt,
      profiles: m.author,
    })),
  };
}

const COLUMNS =
  "id, category, title, body, page_path, user_agent, status, priority, created_at, auto_fix_status, auto_fix_url, duplicate_of, images, profiles(id, nickname), inquiry_messages(id, body, is_admin, created_at, profiles(id, nickname))";

function toInquiry(row: Row, now: number): Inquiry {
  const messages = row.inquiry_messages
    .map((m) => ({ id: m.id, body: m.body, isAdmin: m.is_admin, createdAt: m.created_at, author: m.profiles }))
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  const last = messages.at(-1);
  return {
    id: row.id,
    category: row.category,
    title: row.title,
    body: row.body,
    pagePath: row.page_path,
    userAgent: row.user_agent,
    status: row.status,
    priority: row.priority,
    createdAt: row.created_at,
    timeLabel: formatRelative(row.created_at, now),
    ageDays: Math.floor((now - Date.parse(row.created_at)) / 864e5),
    author: row.profiles,
    autoFixStatus: row.auto_fix_status,
    autoFixUrl: row.auto_fix_url,
    duplicateOf: row.duplicate_of,
    images: row.images,
    messages,
    answered: last?.isAdmin === true,
    waitingAdmin: last !== undefined && !last.isAdmin,
  };
}

// 관리자인지 (app_admins에 있는지)
export async function isAppAdmin() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("is_app_admin");
  return data === true;
}

// 문의가 들어온 지 며칠 지났는지 (관리자 목록에서 오래된 미처리 문의 표시)
export const STALE_DAYS = 3;

// 관리자 목록 순서: 처리 안 된 긴급 → 처리 안 된 채 오래된 문의 → 나머지 최신 순. (보류는 '처리 안 됨'에서 뺀다)
function adminRank(inquiry: Inquiry) {
  const open = inquiry.status === "received" || inquiry.status === "in_progress";
  if (open && inquiry.priority === "urgent") return 0;
  if (open && inquiry.ageDays >= STALE_DAYS) return 1;
  return 2;
}

// 문의 목록. mine이면 내 문의만 최신 순, 아니면 (관리자에게) 전체를 위 순서로.
// 관리자 목록에서는 중복으로 묶인 문의를 빼고, 원래 문의에 묶인 수를 붙인다.
export async function getInquiries({
  mine,
  status,
}: {
  mine: boolean;
  status?: InquiryStatus;
}): Promise<(Inquiry & { duplicates: number })[]> {
  const rows = inquiriesOnSpring() ? await listFromSpring(mine, status) : await listFromSupabase(mine, status);
  // 현재 시각이 필요하므로 렌더링이 아니라 데이터를 불러올 때 계산한다.
  const now = Date.now();
  const all = rows.map((row) => toInquiry(row, now));
  if (mine) return all.map((inquiry) => ({ ...inquiry, duplicates: 0 }));

  const counts = new Map<string, number>();
  for (const inquiry of all) {
    if (inquiry.duplicateOf) counts.set(inquiry.duplicateOf, (counts.get(inquiry.duplicateOf) ?? 0) + 1);
  }
  // 원래 문의가 목록(같은 상태 거르기)에 없으면 중복 문의도 그대로 보여 준다.
  const ids = new Set(all.map((inquiry) => inquiry.id));
  return all
    .filter((inquiry) => !inquiry.duplicateOf || !ids.has(inquiry.duplicateOf))
    .map((inquiry) => ({ ...inquiry, duplicates: counts.get(inquiry.id) ?? 0 }))
    .sort((a, b) => adminRank(a) - adminRank(b));
}

async function listFromSupabase(mine: boolean, status?: InquiryStatus): Promise<Row[]> {
  const supabase = await createClient();
  let query = supabase.from("inquiries").select(COLUMNS).order("created_at", { ascending: false }).limit(200);
  if (mine) {
    const { data: auth } = await supabase.auth.getUser();
    query = query.eq("user_id", auth.user?.id ?? "");
  }
  if (status) query = query.eq("status", status);
  const { data, error } = await query.overrideTypes<Row[], { merge: false }>();
  if (error) throw new Error(`문의를 불러오지 못했어요. (${error.message})`);
  return data;
}

async function listFromSpring(mine: boolean, status?: InquiryStatus): Promise<Row[]> {
  const params = new URLSearchParams({ mine: String(mine) });
  if (status) params.set("status", status);
  const response = await backendFetch(`/api/inquiries?${params}`);
  if (!response.ok) throw new Error(`문의를 불러오지 못했어요. (${await backendError(response, String(response.status))})`);
  return ((await response.json()) as ApiInquiry[]).map(fromApi);
}

// 문의 하나. 본인이나 관리자가 아니면 RLS 때문에 null.
export async function getInquiry(id: string): Promise<Inquiry | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  if (inquiriesOnSpring()) {
    const response = await backendFetch(`/api/inquiries/${id}`);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`문의를 불러오지 못했어요. (${await backendError(response, String(response.status))})`);
    return toInquiry(fromApi((await response.json()) as ApiInquiry), Date.now());
  }
  const supabase = await createClient();
  const { data } = await supabase
    .from("inquiries")
    .select(COLUMNS)
    .eq("id", id)
    .maybeSingle()
    .overrideTypes<Row, { merge: false }>();
  return data ? toInquiry(data, Date.now()) : null;
}

// 관리자: 이 문의와 묶인 문의들 (이 문의가 원래 문의면 중복들, 중복이면 원래 문의와 다른 중복들)
export async function getRelatedInquiries(inquiry: Inquiry): Promise<{ id: string; title: string; timeLabel: string }[]> {
  const root = inquiry.duplicateOf ?? inquiry.id;
  const supabase = await createClient();
  const { data } = await supabase
    .from("inquiries")
    .select("id, title, created_at")
    .or(`id.eq.${root},duplicate_of.eq.${root}`)
    .neq("id", inquiry.id)
    .order("created_at");
  const now = Date.now();
  return (data ?? []).map((row) => ({ id: row.id, title: row.title, timeLabel: formatRelative(row.created_at, now) }));
}

// 첨부 사진을 1시간짜리 주소로 바꾼다. (비공개 저장소, 본인·관리자만)
export async function getInquiryImageUrls(paths: string[]): Promise<string[]> {
  if (paths.length === 0) return [];
  const supabase = await createClient();
  const { data } = await supabase.storage.from("inquiry-images").createSignedUrls(paths, 3600);
  return (data ?? []).flatMap((item) => (item.signedUrl ? [item.signedUrl] : []));
}

// 관리자 머리글 배지: 아직 손대지 않은(접수) 문의 수. 관리자가 아니면 null.
export async function getAdminInquiryBadge(): Promise<number | null> {
  if (!(await isAppAdmin())) return null;
  const supabase = await createClient();
  const { count } = await supabase
    .from("inquiries")
    .select("id", { count: "exact", head: true })
    .eq("status", "received")
    .is("duplicate_of", null);
  return count ?? 0;
}
