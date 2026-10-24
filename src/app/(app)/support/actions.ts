"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { getUserId } from "@/lib/auth";
import { isAppAdmin } from "@/lib/inquiries";
import { sendKakaoToMe } from "@/lib/kakao-message";
import { sendToUser } from "@/lib/push";
import { createClient } from "@/lib/supabase/server";

export type InquiryFormState = { error?: string };

const CATEGORIES = new Set(["bug", "feature", "usage", "account", "other"]);

// 문의를 남긴다. 화면 주소·기기 정보는 오류를 재현하는 데 쓴다.
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

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inquiries")
    .insert({
      category,
      title,
      body,
      page_path: pagePath.startsWith("/") ? pagePath.slice(0, 300) : null,
      user_agent: text("userAgent").slice(0, 400) || null,
    })
    .select("id")
    .single();
  if (error?.message.includes("too many")) return { error: "문의는 하루에 5건까지 남길 수 있어요." };
  if (error || !data) return { error: "문의를 남기지 못했어요. 다시 시도해 주세요." };

  redirect(`/support/${data.id}?sent=1`);
}

// 관리자: 상태와 답변을 바꾼다. 답변이 새로 달리면 문의한 사람에게 푸시 알림을 보낸다.
export async function updateInquiry(id: string, _prev: InquiryFormState, formData: FormData): Promise<InquiryFormState> {
  const status = formData.get("status")?.toString() ?? "";
  const reply = formData.get("reply")?.toString().trim() ?? "";
  if (!["received", "in_progress", "done"].includes(status)) return { error: "상태를 골라 주세요." };
  if (reply.length > 2000) return { error: "답변은 2000자까지 쓸 수 있어요." };

  const supabase = await createClient();
  const { data: before } = await supabase.from("inquiries").select("reply, user_id, title").eq("id", id).maybeSingle();
  const { data, error } = await supabase
    .from("inquiries")
    .update({ status, reply: reply || null })
    .eq("id", id)
    .select("id");
  // 관리자가 아니면 RLS 때문에 바뀐 행이 없다.
  if (error || !data?.length) return { error: "저장하지 못했어요." };

  if (reply && reply !== before?.reply && before?.user_id) {
    const userId = before.user_id;
    after(() => sendToUser(userId, { title: "문의에 답변이 왔어요", body: before.title, url: `/support/${id}` }));
  }
  refresh();
  return {};
}

// 관리자: 카톡 알림이 잘 오는지 시험 메시지를 보낸다.
export async function sendTestKakao(): Promise<{ error?: string; sent?: boolean }> {
  if (!(await isAppAdmin())) return { error: "관리자만 보낼 수 있어요." };
  try {
    const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://jjoin.vercel.app";
    const sent = await sendKakaoToMe(await getUserId(), {
      text: "📮 jjoin 문의 알림 시험\n새 문의가 오면 1시간마다 이렇게 모아서 알려 드려요.",
      url: `${base}/support/admin`,
      button: "문의 보기",
    });
    return sent ? { sent: true } : { error: "먼저 카톡 알림을 연결해 주세요." };
  } catch {
    return { error: "보내지 못했어요. 연결을 다시 해 주세요." };
  }
}
