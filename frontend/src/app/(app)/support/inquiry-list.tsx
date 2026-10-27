import Link from "next/link";
import { INQUIRY_STATUS, STALE_DAYS, categoryOf, type Inquiry } from "@/lib/inquiries";

// 문의 목록 한 줄씩. 답변이 달린 문의는 "답변 도착"을 붙인다.
// admin(관리자 화면): 작성자, 긴급, 오래된 미처리(N일째), 묶인 같은 문의 수, 문의한 사람의 새 글, 수정안 표시
export function InquiryList({
  inquiries,
  admin = false,
}: {
  inquiries: (Inquiry & { duplicates: number })[];
  admin?: boolean;
}) {
  return (
    <ul className="flex flex-col gap-2">
      {inquiries.map((inquiry) => {
        const status = INQUIRY_STATUS[inquiry.status];
        const category = categoryOf(inquiry.category);
        const open = inquiry.status === "received" || inquiry.status === "in_progress";
        return (
          <li key={inquiry.id}>
            <Link
              href={`/support/${inquiry.id}`}
              transitionTypes={["nav-forward"]}
              className={`flex flex-col gap-1 rounded-2xl px-4 py-3 transition active:scale-[0.99] ${
                admin && open && inquiry.priority === "urgent"
                  ? "bg-red-50 ring-1 ring-red-200 dark:bg-red-950/40 dark:ring-red-900"
                  : "bg-stone-100 dark:bg-stone-900"
              }`}
            >
              <span className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate font-medium">
                  {category.icon} {inquiry.title}
                </span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${status.className}`}>
                  {status.label}
                </span>
              </span>
              <span className="flex flex-wrap items-center gap-x-2 text-xs text-stone-500">
                {category.label} · {inquiry.timeLabel}
                {admin && inquiry.author && ` · ${inquiry.author.nickname}`}
                {admin && open && inquiry.priority === "urgent" && <b className="text-red-600">긴급</b>}
                {admin && open && inquiry.ageDays >= STALE_DAYS && <b className="text-amber-600">{inquiry.ageDays}일째</b>}
                {admin && inquiry.duplicates > 0 && <b className="text-sky-600">같은 문의 +{inquiry.duplicates}</b>}
                {admin && inquiry.waitingAdmin && inquiry.messages.length > 0 && <b className="text-brand-ink">새 글</b>}
                {!admin && inquiry.answered && <b className="text-brand-ink">답변 도착</b>}
                {admin && inquiry.autoFixStatus === "pr_opened" && <b className="text-violet-600">수정안 있음</b>}
                {inquiry.images.length > 0 && <span>📷 {inquiry.images.length}</span>}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
