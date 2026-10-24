import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { Page, Reveal } from "@/components/slide-view";
import { INQUIRY_STATUS, getInquiries, isAppAdmin, type InquiryStatus } from "@/lib/inquiries";
import { InquiryList } from "../inquiry-list";
import { KakaoTestButton } from "./kakao-test-button";
import { getUserId } from "@/lib/auth";
import { formatEventDate } from "@/lib/datetime";
import { getKakaoConnection } from "@/lib/kakao-message";

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
          <AdminContent
            status={typeof query.status === "string" ? query.status : "all"}
            kakao={typeof query.kakao === "string" ? query.kakao : null}
            reason={typeof query.reason === "string" ? query.reason.slice(0, 40) : null}
          />
        ))}
      </Suspense>
    </Page>
  );
}

// 카톡 연결 실패 원인별 안내 (카카오 오류 코드 KOE…)
const KAKAO_REASONS: Record<string, string> = {
  KOE010: "클라이언트 시크릿이 필요해요. KAKAO_CLIENT_SECRET 환경변수를 넣어 주세요.",
  KOE006: "등록되지 않은 Redirect URI예요. 카카오 콘솔의 REST API 키에 콜백 주소를 추가해 주세요.",
  KOE320: "동의 코드가 만료됐어요. 다시 연결해 주세요.",
  KOE303: "Redirect URI가 맞지 않아요.",
  access_denied: "카카오 동의를 취소했어요.",
  state: "연결 확인값이 맞지 않아요. 다시 연결해 주세요.",
  save: "토큰은 받았지만 저장하지 못했어요.",
};

async function AdminContent({ status, kakao, reason }: { status: string; kakao: string | null; reason: string | null }) {
  if (!(await isAppAdmin())) notFound();
  const filter = FILTERS.find((f) => f.value === status)?.value ?? "all";
  const [inquiries, connection] = await Promise.all([
    getInquiries({ mine: false, status: filter === "all" ? undefined : filter }),
    getUserId().then(getKakaoConnection),
  ]);

  return (
    <Reveal className="flex flex-col gap-4">
      {/* 1시간 문의 요약을 받을 카톡 연결. 카카오 토큰은 약 2달마다 다시 연결해야 할 수 있다. */}
      <section className="flex flex-col gap-2 rounded-2xl bg-yellow-100 p-4 text-sm text-stone-800 dark:bg-yellow-950/50 dark:text-stone-200">
        <span className="font-semibold">💬 카톡 알림 (1시간 요약)</span>
        {kakao === "connected" && <span className="text-emerald-700 dark:text-emerald-300">✓ 연결했어요.</span>}
        {kakao === "failed" && (
          <span className="text-red-600">
            연결하지 못했어요.{" "}
            {reason ? `${KAKAO_REASONS[reason] ?? "다시 시도해 주세요."} (${reason})` : "다시 시도해 주세요."}
          </span>
        )}
        <span className="text-xs text-stone-600 dark:text-stone-400">
          {connection
            ? `연결됨 · ${formatEventDate(connection.updated_at)} 갱신${connection.refresh_expires_at ? ` · ${formatEventDate(connection.refresh_expires_at)}까지 유효` : ""}`
            : "아직 연결하지 않았어요. 연결하면 새 문의를 카톡 나와의 채팅으로 모아서 보내 드려요."}
        </span>
        <span className="flex flex-wrap items-center gap-2">
          {/* 경로 처리기(route.ts)로 가야 해서 Link 대신 a를 쓴다. */}
          <a href="/api/admin/kakao/connect" className="rounded-full bg-yellow-400 px-3 py-1 text-xs font-semibold text-stone-900">
            {connection ? "다시 연결" : "카톡 알림 연결"}
          </a>
          {connection && <KakaoTestButton />}
        </span>
      </section>
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
