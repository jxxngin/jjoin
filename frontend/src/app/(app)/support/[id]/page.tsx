import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { Page, Reveal } from "@/components/slide-view";
import { formatEventDate } from "@/lib/datetime";
import {
  INQUIRY_STATUS,
  categoryOf,
  getInquiry,
  getInquiryImageUrls,
  getRelatedInquiries,
  isAppAdmin,
} from "@/lib/inquiries";
import { AdminPanel } from "./admin-panel";
import { MarkInquiryRead } from "./mark-inquiry-read";
import { MessageForm } from "./message-form";

const AUTO_FIX_LABELS = {
  pending: "자동 수정 시도 중",
  pr_opened: "수정안이 준비됐어요",
  failed: "자동으로 고치지 못했어요",
  skipped: "자동 수정 대상이 아니에요",
  capped: "오늘 자동 수정 한도를 넘어 쉬었어요",
} as const;

// 문의 하나: 내용, 스크린샷, 처리 상태, 주고받은 대화. 관리자에게는 기기 정보·자동 수정·같은 문의와 관리 칸을 더 보여 준다.
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
  const [images, related] = await Promise.all([
    getInquiryImageUrls(inquiry.images),
    admin ? getRelatedInquiries(inquiry) : Promise.resolve([]),
  ]);
  const status = INQUIRY_STATUS[inquiry.status];
  const category = categoryOf(inquiry.category);

  return (
    <Reveal className="flex flex-col gap-6">
      <MarkInquiryRead inquiryId={inquiry.id} />
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
          {admin && inquiry.priority === "urgent" && <b className="text-xs text-red-600">🚨 긴급</b>}
        </div>
        <h1 className="text-2xl font-bold tracking-tight">{inquiry.title}</h1>
        <p className="text-xs text-stone-400">
          {formatEventDate(inquiry.createdAt)}
          {admin && inquiry.author && ` · ${inquiry.author.nickname}`}
        </p>
      </div>

      <p className="text-sm whitespace-pre-wrap break-words">{inquiry.body}</p>

      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {images.map((url, i) => (
            <a
              key={url}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="aspect-square overflow-hidden rounded-xl bg-stone-100 dark:bg-stone-900"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- 비공개 저장소의 1시간짜리 주소 */}
              <img src={url} alt={`스크린샷 ${i + 1}`} className="size-full object-cover" />
            </a>
          ))}
        </div>
      )}

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
          {related.length > 0 && (
            <div className="mt-1 flex flex-col gap-1">
              <dt className="font-medium">{inquiry.duplicateOf ? "같은 문의로 묶임" : `같은 문의 ${related.length}건 (답변·상태가 같이 바뀌어요)`}</dt>
              {related.map((other) => (
                <dd key={other.id}>
                  <Link href={`/support/${other.id}`} className="text-violet-600 underline">
                    {other.id === inquiry.duplicateOf ? "원래 문의 · " : ""}
                    {other.title}
                  </Link>{" "}
                  · {other.timeLabel}
                </dd>
              ))}
            </div>
          )}
        </dl>
      )}

      <section className="flex flex-col gap-3">
        {inquiry.messages.length === 0 ? (
          !admin && <p className="text-sm text-stone-500">아직 답변이 없어요. 확인하는 대로 알려 드릴게요.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {inquiry.messages.map((message) => (
              <li
                key={message.id}
                className={`flex flex-col gap-1 rounded-2xl p-4 ${
                  message.isAdmin ? "mr-6 bg-brand/10" : "ml-6 bg-stone-100 dark:bg-stone-900"
                }`}
              >
                <span className={`text-xs font-semibold ${message.isAdmin ? "text-brand-ink" : "text-stone-500"}`}>
                  {message.isAdmin ? "jjoin 답변" : admin ? (message.author?.nickname ?? "문의한 사람") : "나"}
                </span>
                <p className="text-sm whitespace-pre-wrap break-words">{message.body}</p>
                <span className="text-xs text-stone-400">{formatEventDate(message.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
        {/* 문의한 사람은 처리 완료 뒤에도 더 물어볼 수 있다. (관리자에게 바로 알림) */}
        <MessageForm inquiryId={inquiry.id} admin={admin} />
      </section>

      {admin && (
        <AdminPanel
          id={inquiry.id}
          status={inquiry.status}
          priority={inquiry.priority}
          canRerun={inquiry.category === "bug" && inquiry.autoFixStatus !== "pending"}
        />
      )}
    </Reveal>
  );
}
