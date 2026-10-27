import Link from "next/link";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { Page, Reveal } from "@/components/slide-view";
import { INQUIRY_CATEGORIES, getInquiries, isAppAdmin } from "@/lib/inquiries";
import { InquiryForm } from "./inquiry-form";
import { InquiryList } from "./inquiry-list";

// 문의하기: 위에서 문의를 쓰고, 아래에서 내 문의의 처리 상태와 답변을 본다.
export default function SupportPage({ searchParams }: PageProps<"/support">) {
  return (
    <Page className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-6">
      <BackLink href="/" label="홈" />
      <h1 className="text-2xl font-bold tracking-tight">문의하기</h1>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-stone-100 dark:bg-stone-900" />}>
        {searchParams.then((query) => (
          <SupportContent fromPath={typeof query.from === "string" ? query.from : null} />
        ))}
      </Suspense>
    </Page>
  );
}

async function SupportContent({ fromPath }: { fromPath: string | null }) {
  const [mine, admin] = await Promise.all([getInquiries({ mine: true }), isAppAdmin()]);
  return (
    <Reveal className="flex flex-col gap-8">
      {admin && (
        <Link
          href="/support/admin"
          transitionTypes={["nav-forward"]}
          className="flex items-center justify-between rounded-2xl bg-violet-100 px-4 py-3 text-sm font-medium text-violet-800 dark:bg-violet-950 dark:text-violet-300"
        >
          관리자 · 전체 문의 보기
          <span>›</span>
        </Link>
      )}
      <InquiryForm categories={INQUIRY_CATEGORIES} fromPath={fromPath?.startsWith("/") ? fromPath : null} />
      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">내 문의 {mine.length}</h2>
        {mine.length === 0 ? (
          <p className="text-sm text-stone-500">아직 남긴 문의가 없어요.</p>
        ) : (
          <InquiryList inquiries={mine} />
        )}
      </section>
    </Reveal>
  );
}
