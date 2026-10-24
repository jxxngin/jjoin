import "server-only";
import type { AvatarColor } from "@/lib/avatar-style";
import { createClient } from "@/lib/supabase/server";

// 장소 후보가 붙는 곳: 약속 또는 날짜 투표 (날짜를 확정하면 투표의 후보는 약속으로 옮겨 간다)
export type PlaceTarget = { kind: "event" | "poll"; id: string };

export type PlaceVoter = { id: string; nickname: string; avatarUrl: string | null; avatarColor: AvatarColor };

// 장소 투표 후보 하나 (카카오맵에서 고른 장소)
export type PlaceOption = {
  id: string;
  name: string;
  address: string | null;
  url: string;
  addedBy: string;
  voters: PlaceVoter[];
};

type Row = {
  id: string;
  place_name: string;
  place_address: string | null;
  place_url: string;
  added_by: string;
  place_votes: {
    user_id: string;
    profiles: { nickname: string; avatar_url: string | null; avatar_color: AvatarColor } | null;
  }[];
};

// 약속·날짜 투표의 장소 후보. 표가 많은 순, 같으면 먼저 올린 순. 그룹 멤버가 아니면 RLS 때문에 빈 목록이다.
export async function getPlaceOptions(target: PlaceTarget): Promise<PlaceOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("place_options")
    .select("id, place_name, place_address, place_url, added_by, place_votes(user_id, profiles(nickname, avatar_url, avatar_color))")
    .eq(target.kind === "event" ? "event_id" : "poll_id", target.id)
    .order("created_at")
    .order("created_at", { referencedTable: "place_votes" })
    .overrideTypes<Row[], { merge: false }>();

  if (error) throw new Error(`장소 후보를 불러오지 못했어요. (${error.message})`);

  return data
    .map((row) => ({
      id: row.id,
      name: row.place_name,
      address: row.place_address,
      url: row.place_url,
      addedBy: row.added_by,
      voters: row.place_votes.flatMap((vote) =>
        vote.profiles
          ? [
              {
                id: vote.user_id,
                nickname: vote.profiles.nickname,
                avatarUrl: vote.profiles.avatar_url,
                avatarColor: vote.profiles.avatar_color,
              },
            ]
          : [],
      ),
    }))
    .sort((a, b) => b.voters.length - a.voters.length);
}
