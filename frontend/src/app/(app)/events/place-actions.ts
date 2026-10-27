"use server";

import { refresh } from "next/cache";
import type { PlaceTarget } from "@/lib/places";
import { createClient } from "@/lib/supabase/server";

// 장소 투표. 약속이나 날짜 투표에 그룹 멤버 누구나 후보를 올리고 투표하며, 만든 사람·방장이 하나를 확정한다.
// 권한은 RLS와 confirm_place_option 함수가 확인한다.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KAKAO_PLACE_URL = /^https?:\/\/place\.map\.kakao\.com\/\d+$/;

export type PlaceOptionFormState = { error?: string; added?: number };

// 카카오맵에서 고른 장소를 후보로 올린다. (PlaceField의 숨은 입력값을 받는다)
export async function addPlaceOption(
  target: PlaceTarget,
  prev: PlaceOptionFormState,
  formData: FormData,
): Promise<PlaceOptionFormState> {
  const text = (key: string) => formData.get(key)?.toString().trim() ?? "";
  const name = text("placeName");
  const lat = Number(text("placeLat"));
  const lng = Number(text("placeLng"));
  const url = text("placeUrl");
  if (!UUID.test(target.id)) return { error: "장소를 올리지 못했어요." };
  if (!name || !text("placeLat") || !KAKAO_PLACE_URL.test(url) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return { error: "검색해서 나온 장소를 골라 주세요." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("place_options").insert({
    [target.kind === "event" ? "event_id" : "poll_id"]: target.id,
    place_name: name.slice(0, 100),
    place_address: text("placeAddress").slice(0, 200) || null,
    place_lat: lat,
    place_lng: lng,
    place_url: url.replace(/^http:/, "https:"),
  });
  if (error?.code === "23505") return { error: "이미 후보에 있는 장소예요." };
  if (error) return { error: "장소를 올리지 못했어요." };

  refresh();
  // 입력칸을 비우도록 몇 번째 추가인지 돌려준다.
  return { added: (prev.added ?? 0) + 1 };
}

// 내 표를 넣거나 뺀다. 여러 장소에 투표할 수 있다.
export async function togglePlaceVote(optionId: string, vote: boolean): Promise<{ error?: string }> {
  if (!UUID.test(optionId)) return { error: "투표하지 못했어요." };
  const supabase = await createClient();
  const { error } = vote
    ? await supabase.from("place_votes").insert({ option_id: optionId })
    : await supabase.from("place_votes").delete().eq("option_id", optionId);
  if (error && error.code !== "23505") return { error: "투표하지 못했어요." };
  refresh();
  return {};
}

// 후보를 약속(또는 날짜 투표)의 장소로 확정한다. 다른 후보와 표는 정리된다.
export async function confirmPlaceOption(optionId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("confirm_place_option", { p_option_id: optionId });
  if (error) return { error: "장소를 확정하지 못했어요." };
  refresh();
  return {};
}

// 올린 사람이나 약속 관리자가 후보를 지운다.
export async function deletePlaceOption(optionId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("place_options").delete().eq("id", optionId).select("id");
  if (error || !data?.length) return { error: "후보를 지우지 못했어요." };
  refresh();
  return {};
}
