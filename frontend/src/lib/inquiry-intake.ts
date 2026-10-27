import "server-only";
import { dispatchAutofix } from "@/lib/autofix";
import { sendToUser, type PushPayload } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/admin";

// 새 문의를 받은 뒤 서버가 하는 일 (응답을 보낸 뒤 after()로):
// 1) 24시간 안의 같은 문의를 찾아 묶는다 (duplicate_of)
// 2) 🐞 오류 신고는 관리자에게 바로 푸시를 보낸다. (나머지는 1시간 요약)
// 3) 묶이지 않은 오류 신고만 자동 수정 작업을 깨운다. (하루 한도는 dispatchAutofix가 지킨다)

// 제목 비교용: 공백·문장부호를 빼고 소문자로
function normalize(text: string) {
  return text.toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "");
}

// 두 글자씩 묶은 조각이 얼마나 겹치는지 (0~1)
function similarity(a: string, b: string) {
  const grams = (text: string) => {
    const list: string[] = [];
    for (let i = 0; i < text.length - 1; i++) list.push(text.slice(i, i + 2));
    return list;
  };
  const left = grams(normalize(a));
  const right = grams(normalize(b));
  if (left.length === 0 || right.length === 0) return normalize(a) === normalize(b) ? 1 : 0;
  const pool = [...right];
  let shared = 0;
  for (const gram of left) {
    const at = pool.indexOf(gram);
    if (at >= 0) {
      shared++;
      pool.splice(at, 1);
    }
  }
  return (2 * shared) / (left.length + right.length);
}

type Candidate = { id: string; category: string; title: string; page_path: string | null };

// 같은 유형이면서, 제목이 거의 같거나(0.7) 같은 화면에서 제목이 비슷한(0.4) 문의
export function findDuplicate(inquiry: Candidate, recent: Candidate[]) {
  return recent.find((other) => {
    if (other.id === inquiry.id || other.category !== inquiry.category) return false;
    const score = similarity(inquiry.title, other.title);
    const samePage = inquiry.page_path !== null && inquiry.page_path === other.page_path;
    return score >= 0.7 || (samePage && score >= 0.4);
  });
}

// 관리자 모두에게 푸시. 한 명이라도 받았으면 true
export async function pushAdmins(payload: PushPayload) {
  const { data: admins } = await createAdminClient().from("app_admins").select("user_id");
  let delivered = false;
  for (const { user_id } of admins ?? []) {
    try {
      if ((await sendToUser(user_id, payload)) > 0) delivered = true;
    } catch (error) {
      console.error("관리자 푸시를 보내지 못했어요", error);
    }
  }
  return delivered;
}

export async function afterInquiryCreated(inquiryId: string) {
  try {
    const admin = createAdminClient();
    const { data: inquiry } = await admin
      .from("inquiries")
      .select("id, category, title, page_path")
      .eq("id", inquiryId)
      .maybeSingle();
    if (!inquiry) return;

    const { data: recent } = await admin
      .from("inquiries")
      .select("id, category, title, page_path")
      .is("duplicate_of", null)
      .neq("status", "done")
      .gt("created_at", new Date(Date.now() - 864e5).toISOString())
      .order("created_at")
      .limit(100);
    const original = findDuplicate(inquiry, recent ?? []);
    if (original) await admin.from("inquiries").update({ duplicate_of: original.id }).eq("id", inquiryId);

    if (inquiry.category !== "bug") return;
    const delivered = await pushAdmins({
      title: original ? "🐞 같은 오류 신고가 또 왔어요" : "🐞 새 오류 신고",
      body: inquiry.title,
      url: `/support/${inquiryId}`,
    });
    // 바로 알렸으면 1시간 요약에서는 뺀다.
    if (delivered) await admin.from("inquiries").update({ notified_at: new Date().toISOString() }).eq("id", inquiryId);
    if (!original) await dispatchAutofix(inquiryId);
  } catch (error) {
    console.error("새 문의 후처리를 하지 못했어요", error);
  }
}
