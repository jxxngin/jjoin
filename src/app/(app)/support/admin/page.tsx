import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { Page, Reveal } from "@/components/slide-view";
import { INQUIRY_STATUS, getInquiries, isAppAdmin, type InquiryStatus } from "@/lib/inquiries";
import { InquiryList } from "../inquiry-list";
import { PushTestButton } from "./push-test-button";

const FILTERS: { value: InquiryStatus | "all"; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "received", label: INQUIRY_STATUS.received.label },
  { value: "in_progress", label: INQUIRY_STATUS.in_progress.label },
  { value: "on_hold", label: INQUIRY_STATUS.on_hold.label },
  { value: "done", label: INQUIRY_STATUS.done.label },
];

// 관리자: 모든 문의. 상태로 거른다. 처리 안 된 긴급·오래된 문의가 위에 오고, 같은 문의는 하나로 묶인다.
// 관리자가 아니면 없는 화면처럼 보인다.
export default function AdminInquiriesPage({ searchParams }: PageProps<"/support/admin">) {
  return (
    <Page className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-6">
      <BackLink href="/support" label="문의하기" />
      <h1 className="text-2xl font-bold tracking-tight">전체 문의</h1>
      <Suspense fallback={<div className="h-80 animate-pulse rounded-2xl bg-stone-100 dark:bg-stone-900" />}>
        {searchParams.then((query) => (
          <AdminContent status={typeof query.status === "string" ? query.status : "all"} />
        ))}
      </Suspense>
    </Page>
  );
}

async function AdminContent({ status }: { status: string }) {
  if (!(await isAppAdmin())) notFound();
  const filter = FILTERS.find((f) => f.value === status)?.value ?? "all";
  const inquiries = await getInquiries({ mine: false, status: filter === "all" ? undefined : filter });

  return (
    <Reveal className="flex flex-col gap-4">
      {/* 오류 신고·문의 대화의 새 글은 바로, 나머지 새 문의는 1시간마다 jjoin 푸시로 온다. (/api/cron/inquiry-digest) */}
      <section className="flex flex-col gap-2 rounded-2xl bg-violet-50 p-4 text-sm dark:bg-violet-950/40">
        <span className="font-semibold">🔔 문의 알림</span>
        <span className="text-xs text-stone-600 dark:text-stone-400">
          🐞 오류 신고와 문의 대화의 새 글은 바로, 다른 새 문의는 1시간마다 모아서 이 휴대폰에 푸시로 알려 드려요. 알림(🔔) 화면의 ⚙️ 알림 설정에서 &ldquo;이 기기에서 알림 받기&rdquo;가 켜져 있어야 해요.
        </span>
        <PushTestButton />
      </section>
      <Link
        href="/support/admin/errors"
        transitionTypes={["nav-forward"]}
        className="flex items-center justify-between rounded-2xl bg-stone-100 px-4 py-3 text-sm font-medium dark:bg-stone-900"
      >
        🧯 화면 오류 기록
        <span>›</span>
      </Link>
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={f.value === "all" ? "/support/admin" : `/support/admin?status=${f.value}`}
            replace
            scroll={false}
            className={`rounded-full px-3 py-1 text-sm font-medium ${
              f.value === filter
                ? "bg-violet-600 text-white"
                : "bg-stone-100 text-stone-600 dark:bg-stone-900 dark:text-stone-300"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>
      {inquiries.length === 0 ? (
        <p className="py-8 text-center text-sm text-stone-500">문의가 없어요.</p>
      ) : (
        <InquiryList inquiries={inquiries} admin />
      )}
    </Reveal>
  );
}
