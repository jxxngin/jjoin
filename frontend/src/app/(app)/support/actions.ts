"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { getUserId } from "@/lib/auth";
import { dispatchAutofix } from "@/lib/autofix";
import { afterInquiryCreated, pushAdmins } from "@/lib/inquiry-intake";
import { isAppAdmin } from "@/lib/inquiries";
import { sendToUser } from "@/lib/push";
import { createClient } from "@/lib/supabase/server";

export type InquiryFormState = { error?: string };

const CATEGORIES = new Set(["bug", "feature", "usage", "account", "other"]);
const STATUSES = new Set(["received", "in_progress", "on_hold", "done"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 문의를 남긴다. 화면 주소·기기 정보는 오류를 재현하는 데 쓴다.
// 스크린샷은 브라우저가 비공개 저장소의 내 폴더에 먼저 올리고, 여기에는 경로만 온다. (inquiry-form.tsx)
export async function createInquiry(_prev: InquiryFormState, formData: FormData): Promise<InquiryFormState> {
  const text = (key: string) => formData.get(key)?.toString().trim() ?? "";
  const category = text("category");
  const title = text("title");
  const body = text("body");
  if (!CATEGORIES.has(category)) return { error: "문의 유형을 골라 주세요." };
  if (title.length < 1 || title.length > 80) return { error: "제목은 1~80자로 입력해 주세요." };
  if (body.length < 1 || body.length > 2000) return { error: "내용은 1~2000자로 입력해 주세요." };
  // 같은 사이트 경로만 남긴다.
  const pagePath = text("pagePath");
  // 내 폴더에 올린 사진만 받는다. (저장소 정책도 본인 폴더만 허용)
  const userId = await getUserId();
  const images = formData
    .getAll("images")
    .map((value) => value.toString())
    .filter((path) => new RegExp(`^${userId}/[0-9a-f-]{36}\\.jpg$`).test(path))
    .slice(0, 3);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inquiries")
    .insert({
      category,
      title,
      body,
      page_path: pagePath.startsWith("/") ? pagePath.slice(0, 300) : null,
      user_agent: text("userAgent").slice(0, 400) || null,
      images,
    })
    .select("id")
    .single();
  if (error?.message.includes("too many")) return { error: "문의는 하루에 5건까지 남길 수 있어요." };
  if (error || !data) return { error: "문의를 남기지 못했어요. 다시 시도해 주세요." };

  // 같은 문의 묶기, 오류 신고 바로 알림과 자동 수정 (응답을 보낸 뒤에)
  after(() => afterInquiryCreated(data.id));

  redirect(`/support/${data.id}?sent=1`);
}

// 관리자: 상태와 우선순위를 바꾼다. 같은 문의로 묶인 문의들도 같은 상태로 바꾼다.
export async function updateInquiry(id: string, status: string, priority: string): Promise<{ error?: string }> {
  if (!UUID.test(id) || !STATUSES.has(status) || !["urgent", "normal"].includes(priority)) {
    return { error: "상태를 다시 골라 주세요." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.from("inquiries").update({ status, priority }).eq("id", id).select("id");
  // 관리자가 아니면 RLS 때문에 바뀐 행이 없다.
  if (error || !data?.length) return { error: "저장하지 못했어요." };
  await supabase.from("inquiries").update({ status }).eq("duplicate_of", id);
  refresh();
  return {};
}

// 문의 대화에 글을 남긴다. 문의한 사람이면 관리자에게 바로 푸시, 관리자면 문의한 사람에게 푸시를 보낸다.
// (관리자 글은 DB가 알림 목록에도 남긴다. 0028) 관리자 글은 같은 문의로 묶인 문의들에도 똑같이 남긴다.
export async function postInquiryMessage(inquiryId: string, body: string): Promise<{ error?: string }> {
  const text = body.trim();
  if (!UUID.test(inquiryId)) return { error: "문의를 찾지 못했어요." };
  if (!text) return { error: "내용을 입력해 주세요." };
  if (text.length > 2000) return { error: "2000자까지 쓸 수 있어요." };

  const [supabase, admin, userId] = [await createClient(), await isAppAdmin(), await getUserId()];
  const { data: inquiry } = await supabase.from("inquiries").select("id, title, user_id").eq("id", inquiryId).maybeSingle();
  if (!inquiry) return { error: "문의를 찾지 못했어요." };

  const targets = [inquiry];
  if (admin) {
    const { data: duplicates } = await supabase.from("inquiries").select("id, title, user_id").eq("duplicate_of", inquiryId);
    targets.push(...(duplicates ?? []));
  }
  const { error } = await supabase
    .from("inquiry_messages")
    .insert(targets.map((target) => ({ inquiry_id: target.id, body: text })));
  if (error?.message.includes("too many")) return { error: "하루에 20개까지 남길 수 있어요." };
  if (error) return { error: "남기지 못했어요. 다시 시도해 주세요." };

  after(async () => {
    try {
      if (admin) {
        for (const target of targets) {
          if (target.user_id && target.user_id !== userId) {
            await sendToUser(target.user_id, { title: "문의에 답변이 왔어요", body: target.title, url: `/support/${target.id}` });
          }
        }
      } else {
        await pushAdmins({ title: "💬 문의에 새 글", body: inquiry.title, url: `/support/${inquiryId}` });
      }
    } catch (e) {
      console.error("문의 대화 알림을 보내지 못했어요", e);
    }
  });
  refresh();
  return {};
}

// 관리자: 오류 신고의 자동 수정을 직접 다시 실행한다. (하루 한도와 상관없이)
export async function rerunAutofix(inquiryId: string): Promise<{ error?: string }> {
  if (!UUID.test(inquiryId) || !(await isAppAdmin())) return { error: "관리자만 실행할 수 있어요." };
  await dispatchAutofix(inquiryId, { force: true });
  refresh();
  return {};
}

// 문의 화면을 열면 그 문의의 답변 알림을 읽음으로 바꾼다.
export async function markInquiryRead(inquiryId: string) {
  if (!UUID.test(inquiryId)) return;
  const userId = await getUserId();
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("inquiry_id", inquiryId)
    .is("read_at", null)
    .select("id");
  if (data && data.length > 0) refresh();
}

// 관리자: 문의 알림(휴대폰 푸시)이 잘 오는지 시험 알림을 보낸다.
export async function sendTestPush(): Promise<{ error?: string; sent?: boolean }> {
  if (!(await isAppAdmin())) return { error: "관리자만 보낼 수 있어요." };
  const delivered = await sendToUser(await getUserId(), {
    title: "📮 jjoin 문의 알림 시험",
    body: "오류 신고는 바로, 다른 문의는 1시간마다 모아서 알려 드려요.",
    url: "/support/admin",
  });
  return delivered > 0
    ? { sent: true }
    : { error: "알림을 켠 기기가 없어요. 알림(🔔) 화면의 ⚙️ 알림 설정에서 “이 기기에서 알림 받기”를 켜 주세요." };
}
