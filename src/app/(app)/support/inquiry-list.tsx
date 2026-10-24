import Link from "next/link";
import { INQUIRY_STATUS, categoryOf, type Inquiry } from "@/lib/inquiries";

// 문의 목록 한 줄씩. 답변이 달린 문의는 "답변 도착"을 붙인다. showAuthor: 관리자 화면에서 작성자 표시
export function InquiryList({ inquiries, showAuthor = false }: { inquiries: Inquiry[]; showAuthor?: boolean }) {
  return (
    <ul className="flex flex-col gap-2">
      {inquiries.map((inquiry) => {
        const status = INQUIRY_STATUS[inquiry.status];
        const category = categoryOf(inquiry.category);
        return (
          <li key={inquiry.id}>
            <Link
              href={`/support/${inquiry.id}`}
              transitionTypes={["nav-forward"]}
              className="flex flex-col gap-1 rounded-2xl bg-stone-100 px-4 py-3 transition active:scale-[0.99] dark:bg-stone-900"
            >
              <span className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate font-medium">
                  {category.icon} {inquiry.title}
                </span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${status.className}`}>
                  {status.label}
                </span>
              </span>
              <span className="flex items-center gap-2 text-xs text-stone-500">
                {category.label} · {inquiry.timeLabel}
                {showAuthor && inquiry.author && ` · ${inquiry.author.nickname}`}
                {inquiry.reply && <b className="text-brand-ink">답변 도착</b>}
                {showAuthor && inquiry.autoFixStatus === "pr_opened" && <b className="text-violet-600">수정안 있음</b>}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
