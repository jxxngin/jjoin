import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { Page, Reveal } from "@/components/slide-view";
import { INQUIRY_STATUS, getInquiries, isAppAdmin, type InquiryStatus } from "@/lib/inquiries";
import { InquiryList } from "../inquiry-list";

const FILTERS: { value: InquiryStatus | "all"; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "received", label: INQUIRY_STATUS.received.label },
  { value: "in_progress", label: INQUIRY_STATUS.in_progress.label },
  { value: "done", label: INQUIRY_STATUS.done.label },
];

// 관리자: 모든 문의. 상태로 거른다. 관리자가 아니면 없는 화면처럼 보인다.
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
      <div className="flex gap-1.5">
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
        <InquiryList inquiries={inquiries} showAuthor />
      )}
    </Reveal>
  );
}
