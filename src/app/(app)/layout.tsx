import { AppFooter } from "@/components/app-footer";
import { AppHeader } from "@/components/app-header";
import { ErrorReporter } from "@/components/error-reporter";
import { PullToRefresh } from "@/components/pull-to-refresh";

// 로그인한 뒤 보는 화면들(홈, 그룹, 약속, 투표, 마이페이지, 알림, 초대)의 공통 틀.
// 머리글과 아래 광고 배너는 여기에 두어 화면을 옮겨도 그대로 남는다. 화면 오류도 여기서 기록한다.
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <ErrorReporter />
      <PullToRefresh />
      <AppHeader />
      {children}
      <AppFooter />
    </>
  );
}
