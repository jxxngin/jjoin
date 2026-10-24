import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { Avatar } from "@/components/avatar";
import { HomeLogoLink } from "@/components/pull-to-refresh";
import { Wordmark } from "@/components/wordmark";
import { getCurrentProfile } from "@/lib/auth";
import { SupportLink } from "@/components/support-link";
import { UnreadDot } from "@/components/unread-dot";
import { getAdminInquiryBadge } from "@/lib/inquiries";
import { getLatestUnreadNotificationId } from "@/lib/notifications";

// 로그인한 뒤 모든 화면 위에 붙는 머리글: 로고(홈), 알림, 내 프로필.
// 스크롤해도 화면 맨 위에 붙어 있고, 화면이 옆으로 넘어가도 움직이지 않게
// view-transition-name을 따로 준다. (globals.css)
export function AppHeader() {
  return (
    <header
      className="sticky top-0 z-40 bg-background pt-[max(1.25rem,env(safe-area-inset-top))] pb-2"
      style={{ viewTransitionName: "app-header" }}
    >
      <div className="mx-auto flex w-full max-w-md items-center justify-between px-4">
        <HomeLogoLink>
          <Image src="/logo-512.png" alt="" width={32} height={32} className="rounded-lg" />
          <Wordmark height={26} priority />
        </HomeLogoLink>
        <Suspense fallback={<div className="h-8 w-[120px]" />}>
          <ProfileMenu />
        </Suspense>
      </div>
    </header>
  );
}

// 오른쪽 위: (관리자만) 관리자 화면, 문의하기, 알림 기록(종), 마이페이지(프로필 사진)
async function ProfileMenu() {
  const [profile, latestUnreadId, adminBadge] = await Promise.all([
    getCurrentProfile(),
    getLatestUnreadNotificationId(),
    getAdminInquiryBadge(),
  ]);

  return (
    <div className="flex items-center gap-3">
      {adminBadge !== null && (
        <Link
          href="/support/admin"
          transitionTypes={["nav-forward"]}
          aria-label={adminBadge > 0 ? `관리자 · 새 문의 ${adminBadge}건` : "관리자"}
          className="relative flex size-8 items-center justify-center text-violet-600 dark:text-violet-400"
        >
          {/* 방패 모양: 관리자에게만 보인다. */}
          <svg viewBox="0 0 24 24" aria-hidden="true" className="size-6">
            <path
              d="M12 3.5 5 6.2v5.3c0 4.3 2.9 7.6 7 9 4.1-1.4 7-4.7 7-9V6.2L12 3.5Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
            <path d="m9 12 2 2 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {adminBadge > 0 && (
            <span className="absolute -top-0.5 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full border-2 border-background bg-violet-600 px-0.5 text-[10px] leading-none font-bold text-white">
              {adminBadge > 9 ? "9+" : adminBadge}
            </span>
          )}
        </Link>
      )}
      <SupportLink />
      <Link
        href="/notifications"
        transitionTypes={["nav-forward"]}
        aria-label={latestUnreadId !== null ? "알림 (새 알림 있음)" : "알림"}
        className="relative flex size-8 items-center justify-center text-stone-600 dark:text-stone-300"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="size-6">
          <path
            d="M6 9a6 6 0 0 1 12 0c0 4.5 1.5 6 2 7H4c.5-1 2-2.5 2-7ZM9.5 16v1a2.5 2.5 0 0 0 5 0v-1"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <UnreadDot latestUnreadId={latestUnreadId} />
      </Link>
      <Link href="/me" transitionTypes={["nav-forward"]} aria-label="마이페이지">
        <Avatar src={profile.avatarUrl} color={profile.avatarColor} size="sm" />
      </Link>
    </div>
  );
}
