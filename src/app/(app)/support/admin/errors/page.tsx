import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { Page, Reveal } from "@/components/slide-view";
import { getClientErrorGroups } from "@/lib/client-errors";
import { isAppAdmin } from "@/lib/inquiries";

// 관리자: 사용자 브라우저에서 난 화면 오류 (최근 7일, 같은 메시지끼리). 기록은 30일 뒤 지워진다.
export default function ClientErrorsPage() {
  return (
    <Page className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-6">
      <BackLink href="/support/admin" label="전체 문의" />
      <h1 className="text-2xl font-bold tracking-tight">화면 오류 기록</h1>
      <Suspense fallback={<div className="h-80 animate-pulse rounded-2xl bg-stone-100 dark:bg-stone-900" />}>
        <ErrorList />
      </Suspense>
    </Page>
  );
}

async function ErrorList() {
  if (!(await isAppAdmin())) notFound();
  const groups = await getClientErrorGroups();
  if (groups.length === 0) {
    return <p className="py-8 text-center text-sm text-stone-500">최근 7일 동안 기록된 오류가 없어요. 🎉</p>;
  }
  return (
    <Reveal className="flex flex-col gap-2">
      <p className="text-xs text-stone-500">최근 7일 · 같은 오류끼리 묶어 많이 난 순서예요.</p>
      <ul className="flex flex-col gap-2">
        {groups.map((group) => (
          <li key={group.message}>
            <details className="rounded-2xl bg-stone-100 px-4 py-3 dark:bg-stone-900">
              <summary className="flex cursor-pointer flex-col gap-1">
                <span className="text-sm font-medium break-words">{group.message}</span>
                <span className="text-xs text-stone-500">
                  {group.count}번 · {group.people}명 · 마지막 {group.lastLabel}
                  {group.lastPath && ` · ${group.lastPath}`}
                </span>
              </summary>
              <div className="mt-2 flex flex-col gap-2 text-xs text-stone-500">
                {group.lastUserAgent && <p className="break-all">{group.lastUserAgent}</p>}
                {group.stack && (
                  <pre className="max-h-60 overflow-auto rounded-xl bg-stone-200 p-2 whitespace-pre-wrap dark:bg-stone-800">
                    {group.stack}
                  </pre>
                )}
              </div>
            </details>
          </li>
        ))}
      </ul>
    </Reveal>
  );
}
