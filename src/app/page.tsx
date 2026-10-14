import { isSupabaseConfigured } from "@/lib/supabase/env";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 px-4 py-16 text-center">
      <h1 className="text-3xl font-bold tracking-tight">낄래?</h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        친구들과의 약속을 한곳에서 만들고 확인해요.
      </p>
      <p className="rounded-full bg-zinc-100 px-3 py-1 text-sm text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
        {isSupabaseConfigured ? "Supabase 연결 설정됨" : "Supabase 설정 필요"}
      </p>
    </main>
  );
}
