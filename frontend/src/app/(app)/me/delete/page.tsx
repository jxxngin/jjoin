import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { Page, Reveal } from "@/components/slide-view";
import { getUserId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DeleteAccountForm } from "./delete-form";

// 회원 탈퇴. 무엇이 지워지고 무엇이 친구들에게 남는지 먼저 보여 준다.
export default function DeleteAccountPage() {
  return (
    <Page className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-6">
      <BackLink href="/me" label="마이페이지" />
      <h1 className="text-2xl font-bold tracking-tight">회원 탈퇴</h1>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-stone-100 dark:bg-stone-900" />}>
        <DeleteAccountContent />
      </Suspense>
    </Page>
  );
}

type OwnedGroup = {
  id: string;
  name: string;
  emoji: string;
  group_members: { user_id: string; joined_at: string; profiles: { nickname: string } | null }[];
};

async function DeleteAccountContent() {
  const userId = await getUserId();
  const supabase = await createClient();
  const { data } = await supabase
    .from("groups")
    .select("id, name, emoji, group_members(user_id, joined_at, profiles(nickname))")
    .eq("owner_id", userId)
    .order("joined_at", { referencedTable: "group_members" })
    .overrideTypes<OwnedGroup[], { merge: false }>();

  // 방장인 그룹마다 누구에게 넘어가는지 (가장 먼저 들어온 다른 멤버, 없으면 그룹 삭제)
  const owned = (data ?? []).map((group) => ({
    ...group,
    heir: group.group_members.find((m) => m.user_id !== userId)?.profiles?.nickname ?? null,
  }));

  return (
    <Reveal className="flex flex-col gap-6">
      <section className="flex flex-col gap-2 rounded-2xl bg-red-50 p-4 text-sm dark:bg-red-950/40">
        <h2 className="font-semibold text-red-700 dark:text-red-300">지워지는 것 · 되돌릴 수 없어요</h2>
        <ul className="list-disc space-y-1 pl-5 text-stone-700 dark:text-stone-300">
          <li>프로필과 프로필 사진</li>
          <li>약속 참여 기록, 내가 쓴 댓글·하트, 날짜·장소 투표, 올린 장소 후보</li>
          <li>알림 기록과 알림 설정</li>
        </ul>
      </section>

      <section className="flex flex-col gap-2 rounded-2xl bg-stone-100 p-4 text-sm dark:bg-stone-900">
        <h2 className="font-semibold">친구들에게 남는 것</h2>
        <ul className="list-disc space-y-1 pl-5 text-stone-700 dark:text-stone-300">
          <li>내가 만든 약속과 날짜 투표는 그 그룹의 방장에게 넘어가요.</li>
          <li>&lsquo;참여&rsquo;로 있던 약속에서는 빠지고, 대기 중인 친구가 자동으로 참여돼요.</li>
          {owned.length > 0 ? (
            <li>
              내가 방장인 그룹은 가장 먼저 들어온 멤버에게 방장이 넘어가요.
              <ul className="mt-1 space-y-0.5 pl-1">
                {owned.map((group) => (
                  <li key={group.id}>
                    {group.emoji} {group.name} →{" "}
                    {group.heir ? <b>{group.heir}</b> : <span className="text-red-600">멤버가 없어 그룹이 삭제돼요</span>}
                  </li>
                ))}
              </ul>
            </li>
          ) : (
            <li>내가 방장인 그룹은 없어요.</li>
          )}
        </ul>
      </section>

      <p className="text-xs text-stone-500">
        카카오 계정 쪽 연결까지 끊으려면 탈퇴 후 카카오톡 → 설정 → 카카오계정 → 연결된 서비스 관리에서 jjoin을 지워 주세요.
      </p>

      <DeleteAccountForm />
    </Reveal>
  );
}
