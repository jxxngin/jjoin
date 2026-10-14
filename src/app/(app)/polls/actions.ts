"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { fromKstInput } from "@/lib/datetime";
import { flushNotifications } from "@/lib/push";
import { createClient } from "@/lib/supabase/server";

export type PollFormState = { error?: string };

const KAKAO_PLACE_URL = /^https?:\/\/place\.map\.kakao\.com\/\d+$/;

// 날짜를 못 정한 약속을 투표로 올린다. 후보 날짜는 2~10개, 모두 지금 이후여야 한다.
export async function createPoll(
  groupId: string,
  _prev: PollFormState,
  formData: FormData,
): Promise<PollFormState> {
  const text = (key: string) => formData.get(key)?.toString().trim() ?? "";
  const title = text("title");
  if (title.length < 1 || title.length > 50) return { error: "제목은 1~50자로 입력해 주세요." };

  const dates = formData
    .getAll("options")
    .map((value) => value.toString())
    .filter(Boolean)
    .map(fromKstInput);
  if (dates.some((date) => date === null)) return { error: "후보 날짜와 시간을 모두 골라 주세요." };
  const unique = [...new Set(dates.map((date) => date!.toISOString()))];
  if (unique.length < 2) return { error: "서로 다른 후보 날짜를 2개 이상 넣어 주세요." };
  if (unique.length > 10) return { error: "후보 날짜는 10개까지 넣을 수 있어요." };
  if (unique.some((iso) => Date.parse(iso) < Date.now())) return { error: "지난 날짜는 후보로 넣을 수 없어요." };

  const maxRaw = text("maxPeople");
  const maxPeople = maxRaw === "" ? null : Number(maxRaw);
  if (maxPeople !== null && !(Number.isInteger(maxPeople) && maxPeople >= 1 && maxPeople <= 100)) {
    return { error: "최대 인원은 1~100 사이 숫자로 입력해 주세요." };
  }
  const memo = text("memo");
  if (memo.length > 500) return { error: "메모는 500자까지 입력할 수 있어요." };

  // 카카오맵에서 고른 장소만 좌표를 저장한다. (약속 만들기와 같은 규칙)
  const placeName = text("placeName");
  const lat = Number(text("placeLat"));
  const lng = Number(text("placeLng"));
  const placeUrl = text("placeUrl");
  const hasPlace = placeName !== "" && text("placeLat") !== "" && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && KAKAO_PLACE_URL.test(placeUrl);

  const supabase = await createClient();
  const { data: pollId, error } = await supabase.rpc("create_date_poll", {
    p_group_id: groupId,
    p_title: title,
    p_place_name: placeName || null,
    p_place_address: hasPlace ? text("placeAddress").slice(0, 200) || null : null,
    p_place_lat: hasPlace ? lat : null,
    p_place_lng: hasPlace ? lng : null,
    p_place_url: hasPlace ? placeUrl.replace(/^http:/, "https:") : null,
    p_max_people: maxPeople,
    p_memo: memo || null,
    p_options: unique,
  });
  if (error || !pollId) return { error: "날짜 투표를 만들지 못했어요." };

  redirect(`/polls/${pollId}`);
}

// 내 표를 넣거나 뺀다. 여러 날짜에 투표할 수 있다.
export async function toggleVote(optionId: string, vote: boolean) {
  const supabase = await createClient();
  if (vote) {
    await supabase.from("date_poll_votes").insert({ option_id: optionId });
  } else {
    // 내 표만 지워진다. (RLS)
    await supabase.from("date_poll_votes").delete().eq("option_id", optionId);
  }
  refresh();
}

export async function closePoll(pollId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("date_polls")
    .update({ closed_at: new Date().toISOString() })
    .eq("id", pollId)
    .select("id");
  if (error || data.length === 0) return { error: "투표를 마감하지 못했어요." };
  refresh();
  return {};
}

export async function reopenPoll(pollId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("date_polls")
    .update({ closed_at: null })
    .eq("id", pollId)
    .is("event_id", null)
    .select("id");
  if (error || data.length === 0) return { error: "투표를 다시 열지 못했어요." };
  refresh();
  return {};
}

// 고른 날짜로 약속을 만든다. 그 날짜에 투표한 사람은 자동으로 참여한다.
export async function confirmPoll(pollId: string, optionId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: eventId, error } = await supabase.rpc("confirm_date_poll", {
    p_poll_id: pollId,
    p_option_id: optionId,
  });
  if (error || !eventId) return { error: "약속을 확정하지 못했어요." };

  // 새 약속 알림(DB 트리거가 쌓음)을 응답 뒤에 보낸다.
  after(async () => {
    try {
      await flushNotifications();
    } catch (e) {
      console.error("새 약속 알림을 보내지 못했어요", e);
    }
  });
  redirect(`/events/${eventId}`);
}

export async function deletePoll(pollId: string, groupId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("date_polls").delete().eq("id", pollId).select("id");
  if (error || data.length === 0) return { error: "투표를 삭제하지 못했어요." };
  redirect(`/groups/${groupId}`);
}
