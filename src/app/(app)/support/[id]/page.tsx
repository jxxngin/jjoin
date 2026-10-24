import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { Page, Reveal } from "@/components/slide-view";
import { formatEventDate } from "@/lib/datetime";
import { INQUIRY_STATUS, categoryOf, getInquiry, isAppAdmin } from "@/lib/inquiries";
import { AdminReply } from "./admin-reply";

const AUTO_FIX_LABELS = {
  pending: "자동 수정 시도 중",
  pr_opened: "수정안이 준비됐어요",
  failed: "자동으로 고치지 못했어요",
  skipped: "자동 수정 대상이 아니에요",
} as const;

// 문의 하나: 내용, 처리 상태, 답변. 관리자에게는 기기 정보·자동 수정 상태와 답변 칸을 더 보여 준다.
export default function InquiryPage({ params, searchParams }: PageProps<"/support/[id]">) {
  return (
    <Page className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-6">
      <Suspense fallback={<div className="h-80 animate-pulse rounded-2xl bg-stone-100 dark:bg-stone-900" />}>
        {Promise.all([params, searchParams]).then(([{ id }, query]) => (
          <InquiryContent id={id} justSent={query.sent === "1"} />
        ))}
      </Suspense>
    </Page>
  );
}

async function InquiryContent({ id, justSent }: { id: string; justSent: boolean }) {
  const [inquiry, admin] = await Promise.all([getInquiry(id), isAppAdmin()]);
  if (!inquiry) notFound();
  const status = INQUIRY_STATUS[inquiry.status];
  const category = categoryOf(inquiry.category);

  return (
    <Reveal className="flex flex-col gap-6">
      <BackLink href={admin ? "/support/admin" : "/support"} label={admin ? "전체 문의" : "문의하기"} />
      {justSent && (
        <p className="rounded-2xl bg-emerald-100 px-4 py-3 text-sm font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
          문의가 접수됐어요. 답변이 달리면 알림으로 알려 드릴게요.
        </p>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-sm text-stone-500">
          <span>
            {category.icon} {category.label}
          </span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.className}`}>{status.label}</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">{inquiry.title}</h1>
        <p className="text-xs text-stone-400">
          {formatEventDate(inquiry.createdAt)}
          {admin && inquiry.author && ` · ${inquiry.author.nickname}`}
        </p>
      </div>

      <p className="text-sm whitespace-pre-wrap break-words">{inquiry.body}</p>

      {admin && (
        <dl className="flex flex-col gap-1 rounded-2xl bg-stone-100 p-4 text-xs text-stone-500 dark:bg-stone-900">
          <div>
            <dt className="inline font-medium">화면 · </dt>
            <dd className="inline break-all">{inquiry.pagePath ?? "없음"}</dd>
          </div>
          <div>
            <dt className="inline font-medium">기기 · </dt>
            <dd className="inline break-all">{inquiry.userAgent ?? "없음"}</dd>
          </div>
          {inquiry.autoFixStatus && (
            <div>
              <dt className="inline font-medium">자동 수정 · </dt>
              <dd className="inline">
                {AUTO_FIX_LABELS[inquiry.autoFixStatus]}
                {inquiry.autoFixUrl && (
                  <a
                    href={inquiry.autoFixUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-1 text-violet-600 underline"
                  >
                    수정안 보기
                  </a>
                )}
              </dd>
            </div>
          )}
        </dl>
      )}

      {inquiry.reply ? (
        <section className="flex flex-col gap-2 rounded-2xl bg-brand/10 p-4">
          <span className="text-sm font-semibold text-brand-ink">jjoin 답변</span>
          <p className="text-sm whitespace-pre-wrap break-words">{inquiry.reply}</p>
          {inquiry.repliedAt && <span className="text-xs text-stone-500">{formatEventDate(inquiry.repliedAt)}</span>}
        </section>
      ) : (
        !admin && <p className="text-sm text-stone-500">아직 답변이 없어요. 확인하는 대로 알려 드릴게요.</p>
      )}

      {admin && <AdminReply id={inquiry.id} status={inquiry.status} reply={inquiry.reply} />}
    </Reveal>
  );
}
