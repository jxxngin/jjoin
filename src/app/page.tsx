import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { signOut } from "@/app/auth/actions";
import { Avatar } from "@/components/avatar";
import { getCurrentProfile } from "@/lib/auth";
import { getMyGroups } from "@/lib/groups";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Image src="/logo.png" alt="" width={32} height={32} className="rounded-lg" />
          <h1 className="text-xl font-bold tracking-tight">낄래?</h1>
        </div>
        <Suspense fallback={<div className="size-8" />}>
          <ProfileMenu />
        </Suspense>
      </header>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">내 그룹</h2>
          <Link
            href="/groups/new"
            className="rounded-full bg-brand px-3 py-1.5 text-sm font-medium text-white"
          >
            + 그룹 만들기
          </Link>
        </div>
        <Suspense fallback={<GroupListSkeleton />}>
          <GroupList />
        </Suspense>
      </section>
    </main>
  );
}

async function ProfileMenu() {
  const profile = await getCurrentProfile();

  return (
    <div className="flex items-center gap-2">
      <Avatar src={profile.avatarUrl} size="sm" />
      <form action={signOut}>
        <button type="submit" className="text-sm text-zinc-500">
          로그아웃
        </button>
      </form>
    </div>
  );
}

async function GroupList() {
  const groups = await getMyGroups();

  if (groups.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 px-4 py-10 text-center text-sm text-zinc-500 dark:border-zinc-700">
        아직 그룹이 없어요.
        <br />
        그룹을 만들거나 친구에게 초대 링크를 받아 보세요.
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {groups.map((group) => (
        <li key={group.id}>
          <Link
            href={`/groups/${group.id}`}
            className="flex items-center justify-between rounded-2xl bg-zinc-100 px-4 py-4 transition active:scale-[0.99] dark:bg-zinc-900"
          >
            <span className="font-medium">{group.name}</span>
            <span className="text-sm text-zinc-500">{group.memberCount}명</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function GroupListSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <div className="h-14 animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-900" />
      <div className="h-14 animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-900" />
    </div>
  );
}
