"use client";

import Link from "next/link";
import { reloadFresh } from "@/lib/report-client-error";

// 문제 해결 팝업(아래에서 올라오는 판). 오래 걸리는 로딩·새로고침으로 풀리는 오류 때 띄운다. (trouble-watcher.tsx)
export function TroubleSheet({
  title,
  description,
  steps,
  onClose,
  closeLabel = "닫기",
}: {
  title: string;
  description: string;
  steps: string[];
  onClose: () => void;
  closeLabel?: string;
}) {
  const from = typeof location === "undefined" ? "/" : location.pathname;
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center p-3" role="dialog" aria-modal="false" aria-label={title}>
      <div className="reveal flex w-full max-w-md flex-col gap-3 rounded-3xl border border-stone-200 bg-background p-5 shadow-2xl dark:border-stone-800">
        <div className="flex flex-col gap-1">
          <span className="font-semibold">{title}</span>
          <span className="text-sm text-stone-500">{description}</span>
        </div>
        <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm text-stone-600 dark:text-stone-300">
          {steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={onClose} className="h-11 rounded-xl bg-stone-100 text-sm font-medium dark:bg-stone-900">
            {closeLabel}
          </button>
          <button type="button" onClick={reloadFresh} className="h-11 rounded-xl bg-brand text-sm font-medium text-white">
            새로 불러오기
          </button>
        </div>
        <Link
          href={`/support?from=${encodeURIComponent(from)}`}
          onClick={onClose}
          className="text-center text-xs text-stone-500 underline underline-offset-4"
        >
          계속 안 되면 문의하기로 알려 주세요
        </Link>
      </div>
    </div>
  );
}
