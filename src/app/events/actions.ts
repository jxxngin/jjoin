"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { fromKstInput } from "@/lib/datetime";
import { createClient } from "@/lib/supabase/server";

export type EventFormValues = {
  title: string;
  startsAt: string;
  placeName: string;
  minPeople: string;
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
    placeName: text("placeName"),
    minPeople: text("minPeople"),
    maxPeople: text("maxPeople"),
    memo: text("memo"),
  };
}

function parsePeople(value: string) {
  if (value === "") return null;
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 100 ? n : NaN;
}

// 검증에 실패하면 오류 메시지를, 통과하면 DB에 넣을 값을 돌려준다.
function validate(values: EventFormValues) {
  if (values.title.length < 1 || values.title.length > 50) {
    return { error: "제목은 1~50자로 입력해 주세요." };
  }

  const startsAt = fromKstInput(values.startsAt);
  if (!startsAt) return { error: "날짜와 시간을 입력해 주세요." };

  const minPeople = parsePeople(values.minPeople);
  const maxPeople = parsePeople(values.maxPeople);
  if (Number.isNaN(minPeople) || Number.isNaN(maxPeople)) {
    return { error: "인원은 1~100 사이 숫자로 입력해 주세요." };
  }
  if (minPeople !== null && maxPeople !== null && minPeople > maxPeople) {
    return { error: "최소 인원이 최대 인원보다 많아요." };
  }

  if (values.placeName.length > 100) return { error: "장소는 100자까지 입력할 수 있어요." };
  if (values.memo.length > 500) return { error: "메모는 500자까지 입력할 수 있어요." };

  return {
    row: {
      title: values.title,
      starts_at: startsAt.toISOString(),
      place_name: values.placeName || null,
      min_people: minPeople,
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
      error: error.message.includes("already started")
        ? "이미 시작한 약속이에요."
        : "참여 상태를 바꾸지 못했어요.",
    };
  }

  refresh();
  return {};
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
