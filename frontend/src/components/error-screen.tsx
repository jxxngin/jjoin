"use client";

import Link from "next/link";
import { useEffect } from "react";
import { isRecoverableError, reloadFresh, reportClientError } from "@/lib/report-client-error";

// 화면을 그리다 오류가 났을 때 보이는 화면. (app/(app)/error.tsx, app/global-error.tsx)
// 오류는 자동으로 기록하고, 다시 시도 → 새로 불러오기 → 홈 → 문의 순서로 해결 방법을 보여 준다.
export function ErrorScreen({ error, retry }: { error: unknown; retry: () => void }) {
  const message = error instanceof Error ? error.message : String(error);
  // 서버 오류는 운영에서 내용 대신 번호(digest)만 온다. 문의할 때 알려 주면 서버 기록과 맞춰 볼 수 있다.
  const digest = error instanceof Error && "digest" in error ? String(error.digest) : null;
  const recoverable = isRecoverableError(message);

  useEffect(() => {
    reportClientError(`[화면 오류] ${message}${digest ? ` (${digest})` : ""}`, error instanceof Error ? error.stack : undefined);
  }, [message, digest, error]);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 px-6 py-16 text-center">
      <span className="text-5xl" aria-hidden>
        {recoverable ? "🔄" : "😵"}
      </span>
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-bold">{recoverable ? "화면을 새로 불러와야 해요" : "잠깐 문제가 생겼어요"}</h1>
        <p className="text-sm text-stone-500">
          {recoverable
            ? "앱이 업데이트됐거나 연결이 잠깐 끊겼어요."
            : "자동으로 알려 두었어요. 아래 방법을 차례로 해 보세요."}
        </p>
      </div>

      <div className="flex w-full flex-col gap-2">
        {recoverable ? (
          <button type="button" onClick={reloadFresh} className="h-12 rounded-xl bg-brand font-medium text-white">
            새로 불러오기
          </button>
        ) : (
          <>
            <button type="button" onClick={retry} className="h-12 rounded-xl bg-brand font-medium text-white">
              다시 시도
            </button>
            <button type="button" onClick={reloadFresh} className="h-12 rounded-xl bg-stone-100 font-medium dark:bg-stone-900">
              새로 불러오기
            </button>
          </>
        )}
        {/* 오류 난 화면 상태를 버리고 처음부터 다시 열도록 일부러 전체 이동을 한다. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/" className="h-12 rounded-xl leading-[3rem] font-medium text-stone-500">
          홈으로
        </a>
      </div>

      <div className="flex flex-col items-center gap-1 text-xs text-stone-400">
        <Link
          href={`/support?from=${encodeURIComponent(typeof location === "undefined" ? "/" : location.pathname)}`}
          className="underline underline-offset-4"
        >
          계속 안 되면 문의하기로 알려 주세요
        </Link>
        {digest && <span>오류 번호 {digest}</span>}
      </div>
    </main>
  );
}
