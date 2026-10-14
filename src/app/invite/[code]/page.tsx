import Link from "next/link";
import { Suspense } from "react";
import { joinGroup } from "@/app/groups/actions";
import { GroupAvatar } from "@/components/group-avatar";
import { getInvite } from "@/lib/groups";

export default function InvitePage({ params }: PageProps<"/invite/[code]">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 px-4 py-16 text-center">
      <Suspense
        fallback={<div className="h-40 w-full animate-pulse rounded-2xl bg-stone-100 dark:bg-stone-900" />}
      >
        {params.then(({ code }) => (
          <InviteContent code={code} />
        ))}
      </Suspense>
    </main>
  );
}

async function InviteContent({ code }: { code: string }) {
  const invite = await getInvite(code);

  if (!invite) {
    return (
      <>
        <h1 className="text-xl font-bold">초대 링크가 올바르지 않아요</h1>
        <p className="text-sm text-stone-500">링크를 다시 확인하거나 친구에게 새로 받아 주세요.</p>
        <Link href="/" className="text-sm text-brand-ink underline underline-offset-4">
          홈으로
        </Link>
      </>
    );
  }

  return (
    <>
      <div className="flex flex-col items-center gap-2">
        <p className="text-sm text-stone-500">그룹 초대</p>
        <GroupAvatar emoji={invite.emoji} color={invite.color} size="lg" />
        <h1 className="text-2xl font-bold tracking-tight">{invite.groupName}</h1>
        {invite.description && <p className="text-stone-600 dark:text-stone-400">{invite.description}</p>}
        <p className="text-sm text-stone-500">멤버 {invite.memberCount}명</p>
      </div>

      {invite.isMember ? (
        <Link
          href={`/groups/${invite.groupId}`}
          className="flex h-12 w-full items-center justify-center rounded-xl bg-stone-100 font-medium dark:bg-stone-900"
        >
          이미 참여 중이에요 · 그룹으로 가기
        </Link>
      ) : (
        <form action={joinGroup} className="w-full">
          <input type="hidden" name="code" value={code} />
          <button
            type="submit"
            className="h-12 w-full rounded-xl bg-brand font-medium text-white transition active:scale-[0.98]"
          >
            참여하기
          </button>
        </form>
      )}
    </>
  );
}
