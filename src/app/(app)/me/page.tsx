import { Suspense } from "react";
import { signOut } from "@/app/auth/actions";
import { BackLink } from "@/components/back-link";
import { getCurrentProfile, getNotificationPrefs } from "@/lib/auth";
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

      <form action={signOut} className="mt-auto">
        <button type="submit" className="text-sm text-stone-500 underline underline-offset-4">
          로그아웃
        </button>
      </form>
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
