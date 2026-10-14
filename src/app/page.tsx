import { Suspense } from "react";
import { signOut } from "@/app/auth/actions";
import { getCurrentProfile } from "@/lib/auth";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">낄래?</h1>
        <form action={signOut}>
          <button
            type="submit"
            className="text-sm text-zinc-500 underline-offset-4 hover:underline"
          >
            로그아웃
          </button>
        </form>
      </header>
      <Suspense
        fallback={<div className="h-16 animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-900" />}
      >
        <Greeting />
      </Suspense>
    </main>
  );
}

async function Greeting() {
  const profile = await getCurrentProfile();

  return (
    <section className="flex items-center gap-3 rounded-2xl bg-zinc-100 p-4 dark:bg-zinc-900">
      {profile.avatarUrl ? (
        // 카카오 프로필 이미지는 외부 도메인이라 next/image 설정 없이 그대로 쓴다.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={profile.avatarUrl}
          alt=""
          className="size-10 rounded-full object-cover"
        />
      ) : (
        <div className="size-10 rounded-full bg-zinc-300 dark:bg-zinc-700" />
      )}
      <p>
        <span className="font-semibold">{profile.nickname}</span>님, 반가워요!
      </p>
    </section>
  );
}
