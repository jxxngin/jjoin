import Image from "next/image";
import { Suspense } from "react";
import { signInWithKakao } from "@/app/auth/actions";

const errorMessages: Record<string, string> = {
  oauth: "카카오 로그인을 시작하지 못했어요. 다시 시도해 주세요.",
  callback: "로그인을 완료하지 못했어요. 다시 시도해 주세요.",
};

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-8 px-4 py-16 text-center">
      <div className="flex flex-col items-center gap-2">
        <Image src="/logo-512.png" alt="" width={96} height={96} priority className="mb-2 rounded-3xl" />
        <h1 className="text-4xl font-bold tracking-tight">jjoin</h1>
        <p className="text-stone-600 dark:text-stone-400">
          친구들과의 약속을 한곳에서 만들고 확인해요.
        </p>
      </div>
      <Suspense fallback={<KakaoButton next="/" />}>
        <LoginForm searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function LoginForm({
  searchParams,
}: {
  searchParams: PageProps<"/login">["searchParams"];
}) {
  const { next, error } = await searchParams;
  const message = typeof error === "string" ? errorMessages[error] : undefined;

  return (
    <div className="flex w-full flex-col gap-3">
      {message && <p className="text-sm text-red-600">{message}</p>}
      <KakaoButton next={typeof next === "string" ? next : "/"} />
    </div>
  );
}

function KakaoButton({ next }: { next: string }) {
  return (
    <form action={signInWithKakao} className="w-full">
      <input type="hidden" name="next" value={next} />
      <button
        type="submit"
        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#FEE500] font-medium text-black/85 transition active:scale-[0.98]"
      >
        <KakaoSymbol />
        카카오로 시작하기
      </button>
    </form>
  );
}

function KakaoSymbol() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#000"
        d="M9 1.5C4.58 1.5 1 4.32 1 7.8c0 2.25 1.5 4.22 3.75 5.33l-.96 3.5c-.08.3.26.54.52.37l4.13-2.73c.18.02.37.03.56.03 4.42 0 8-2.82 8-6.3S13.42 1.5 9 1.5Z"
      />
    </svg>
  );
}
