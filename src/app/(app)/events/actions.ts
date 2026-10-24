"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { endsAtFromLastDay, formatNights, fromKstInput } from "@/lib/datetime";
import { MANUAL_END_REASONS } from "@/lib/event-status";
import { flushNotifications } from "@/lib/push";
import { createClient } from "@/lib/supabase/server";

export type EventFormValues = {
  title: string;
  startsAt: string;
  // 여러 날 약속의 마지막 날 "2026-10-26". 하루 약속이면 빈 문자열
  endsOn: string;
  placeName: string;
  placeAddress: string;
  placeLat: string;
  placeLng: string;
  placeUrl: string;
  maxPeople: string;
  memo: string;
};

export type EventFormState = {
  error?: string;
  // 오류가 나도 입력한 값이 지워지지 않게 돌려준다.
  values?: EventFormValues;
};

function readForm(formData: FormData): EventFormValues {
  const text = (key: string) => formData.get(key)?.toString().trim() ?? "";
  return {
    title: text("title"),
    startsAt: text("startsAt"),
    endsOn: text("endsOn"),
    placeName: text("placeName"),
    placeAddress: text("placeAddress"),
    placeLat: text("placeLat"),
    placeLng: text("placeLng"),
    placeUrl: text("placeUrl"),
    maxPeople: text("maxPeople"),
    memo: text("memo"),
  };
}

function parsePeople(value: string) {
  if (value === "") return null;
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 100 ? n : NaN;
}

const KAKAO_PLACE_URL = /^https?:\/\/place\.map\.kakao\.com\/\d+$/;

// 카카오맵에서 고른 장소만 좌표와 링크가 있다. 값이 이상하면 이름만 저장한다.
function parsePlace(values: EventFormValues) {
  const lat = Number(values.placeLat);
  const lng = Number(values.placeLng);
  const valid =
    values.placeName !== "" &&
    values.placeLat !== "" &&
    values.placeLng !== "" &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180 &&
    KAKAO_PLACE_URL.test(values.placeUrl);

  if (!valid) {
    return { place_address: null, place_lat: null, place_lng: null, place_url: null };
  }
  return {
    place_address: values.placeAddress.slice(0, 200) || null,
    place_lat: lat,
    place_lng: lng,
    place_url: values.placeUrl.replace(/^http:/, "https:"),
  };
}

// 검증에 실패하면 오류 메시지를, 통과하면 DB에 넣을 값을 돌려준다.
function validate(values: EventFormValues) {
  if (values.title.length < 1 || values.title.length > 50) {
    return { error: "제목은 1~50자로 입력해 주세요." };
  }

  const startsAt = fromKstInput(values.startsAt);
  if (!startsAt) return { error: "날짜와 시간을 입력해 주세요." };

  // 마지막 날이 시작한 날과 같으면 하루 약속으로 친다.
  const firstDay = values.startsAt.slice(0, 10);
  let endsAt: Date | null = null;
  if (values.endsOn && values.endsOn !== firstDay) {
    if (!/^d{4}-d{2}-d{2}$/.test(values.endsOn) || values.endsOn < firstDay) {
      return { error: "끝나는 날은 시작하는 날보다 뒤여야 해요." };
    }
    if (Number.parseInt(formatNights(firstDay, values.endsOn)) > 30) {
      return { error: "여러 날 약속은 30박까지 잡을 수 있어요." };
    }
    endsAt = endsAtFromLastDay(values.endsOn);
  }

  const maxPeople = parsePeople(values.maxPeople);
  if (Number.isNaN(maxPeople)) {
    return { error: "최대 인원은 1~100 사이 숫자로 입력해 주세요." };
  }

  if (values.placeName.length > 100) return { error: "장소는 100자까지 입력할 수 있어요." };
  if (values.memo.length > 500) return { error: "메모는 500자까지 입력할 수 있어요." };

  return {
    row: {
      title: values.title,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt?.toISOString() ?? null,
      place_name: values.placeName || null,
      ...parsePlace(values),
      max_people: maxPeople,
      memo: values.memo || null,
    },
  };
}

export async function createEvent(
  groupId: string,
  _prev: EventFormState,
  formData: FormData,
): Promise<EventFormState> {
  const values = readForm(formData);
  const { error, row } = validate(values);
  if (!row) return { error, values };

  const supabase = await createClient();
  const { data, error: dbError } = await supabase
    .from("events")
    .insert({ ...row, group_id: groupId })
    .select("id")
    .single();
  if (dbError || !data) {
    return { error: "약속을 만들지 못했어요. 다시 시도해 주세요.", values };
  }

  after(sendQueuedNotifications);
  redirect(`/events/${data.id}`);
}

export async function updateEvent(
  eventId: string,
  _prev: EventFormState,
  formData: FormData,
): Promise<EventFormState> {
  const values = readForm(formData);
  const { error, row } = validate(values);
  if (!row) return { error, values };

  // 권한이 없으면 RLS 때문에 수정된 행이 없다.
  const supabase = await createClient();
  const { data, error: dbError } = await supabase
    .from("events")
    .update(row)
    .eq("id", eventId)
    .select("id");
  if (dbError || data.length === 0) {
    return { error: "약속을 수정하지 못했어요.", values };
  }

  // 최대 인원을 늘리면 대기자가 승격될 수 있다.
  after(sendQueuedNotifications);
  redirect(`/events/${eventId}`);
}

export async function setParticipation(
  eventId: string,
  status: "going" | "maybe" | "not_going",
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_participation", {
    eid: eventId,
    new_status: status,
  });

  if (error) {
    return {
      error: error.message.includes("already ended")
        ? "이미 종료된 약속이에요."
        : "참여 상태를 바꾸지 못했어요.",
    };
  }

  after(sendQueuedNotifications);
  refresh();
  return {};
}

export async function endEvent(
  eventId: string,
  _prev: { error?: string },
  formData: FormData,
): Promise<{ error?: string }> {
  const reason = formData.get("reason")?.toString() ?? "";
  const note = formData.get("note")?.toString().trim() ?? "";

  if (!(MANUAL_END_REASONS as readonly string[]).includes(reason)) {
    return { error: "종료 사유를 골라 주세요." };
  }
  if (reason === "other" && !note) return { error: "기타 사유를 적어 주세요." };
  if (note.length > 100) return { error: "사유는 100자까지 적을 수 있어요." };

  // 권한이 없으면 RLS 때문에 수정된 행이 없다.
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .update({ ended_at: new Date().toISOString(), end_reason: reason, end_note: note || null })
    .eq("id", eventId)
    .select("id");
  if (error || data.length === 0) return { error: "약속을 종료하지 못했어요." };

  refresh();
  return {};
}

export async function reopenEvent(formData: FormData) {
  const eventId = formData.get("eventId")?.toString() ?? "";

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .update({ ended_at: null, end_reason: null, end_note: null })
    .eq("id", eventId)
    .select("id");
  if (error || data.length === 0) throw new Error("약속을 다시 열지 못했어요.");

  refresh();
}

export async function deleteEvent(formData: FormData) {
  const eventId = formData.get("eventId")?.toString() ?? "";
  const groupId = formData.get("groupId")?.toString() ?? "";

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .delete()
    .eq("id", eventId)
    .select("id");
  if (error || data.length === 0) throw new Error("약속을 삭제하지 못했어요.");

  redirect(`/groups/${groupId}`);
}

// DB 트리거가 쌓아 둔 알림(새 약속·대기 승격)을 응답을 보낸 뒤에 보낸다.
// 알림이 실패해도 약속 처리에는 영향이 없게 오류는 기록만 한다.
async function sendQueuedNotifications() {
  try {
    await flushNotifications();
  } catch (error) {
    console.error("알림을 보내지 못했어요", error);
  }
}
