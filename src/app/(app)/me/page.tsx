import Link from "next/link";
import { Suspense } from "react";
import { signOut } from "@/app/auth/actions";
import { BackLink } from "@/components/back-link";
import { getCurrentProfile, getNotificationPrefs } from "@/lib/auth";
import { getAdminInquiryBadge } from "@/lib/inquiries";
import { NotificationSettings } from "./notification-settings";
import { ProfileForm } from "./profile-form";
import { ThemePicker } from "./theme-picker";
import { Page, Reveal } from "@/components/slide-view";

export default function MyPage() {
  return (
    <Page className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-6">
      <BackLink href="/" label="홈" />
      <h1 className="text-2xl font-bold tracking-tight">마이페이지</h1>

      <Suspense fallback={<div className="h-80 animate-pulse rounded-2xl bg-stone-100 dark:bg-stone-900" />}>
        <ProfileSection />
      </Suspense>

      <Suspense fallback={<div className="h-48 animate-pulse rounded-2xl bg-stone-100 dark:bg-stone-900" />}>
        <NotificationSection />
      </Suspense>

      <ThemePicker />

      <Suspense fallback={null}>
        <AdminMenu />
      </Suspense>

      <div className="mt-auto flex items-center justify-between">
        <form action={signOut}>
          <button type="submit" className="text-sm text-stone-500 underline underline-offset-4">
            로그아웃
          </button>
        </form>
        <Link href="/me/delete" transitionTypes={["nav-forward"]} className="text-xs text-stone-400">
          회원 탈퇴
        </Link>
      </div>
    </Page>
  );
}

async function ProfileSection() {
  const profile = await getCurrentProfile();
  return (
    <Reveal>
      <ProfileForm profile={profile} />
    </Reveal>
  );
}

async function NotificationSection() {
  const prefs = await getNotificationPrefs();
  return (
    <Reveal>
      <NotificationSettings prefs={prefs} />
    </Reveal>
  );
}

// 관리자에게만: 문의 관리 화면으로 가는 메뉴 (머리글 방패 아이콘과 같은 곳)
async function AdminMenu() {
  const badge = await getAdminInquiryBadge();
  if (badge === null) return null;
  return (
    <Link
      href="/support/admin"
      transitionTypes={["nav-forward"]}
      className="flex items-center justify-between rounded-2xl bg-violet-100 px-4 py-3 text-sm font-medium text-violet-800 dark:bg-violet-950 dark:text-violet-300"
    >
      <span>🛡️ 관리자 · 문의 관리</span>
      <span>{badge > 0 ? `새 문의 ${badge}건 ›` : "›"}</span>
    </Link>
  );
}
