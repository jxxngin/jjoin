import { ViewTransition } from "react";

// 화면 전환 애니메이션. CSS는 globals.css의 .nav-forward / .nav-back.
//
// 링크의 transitionTypes로 방향을 정한다.
// - nav-forward / nav-back: 다른 화면으로 들어가고 나올 때 (PageTransition)
// - view-forward / view-back: 같은 화면 안에서 목록↔캘린더, 주·달 넘김 (SlideView)
// 둘을 나눠야 화면에 들어갈 때 안쪽 캘린더가 한 번 더 미끄러지지 않는다.

// 화면(page) 전체. 방향이 있으면 옆으로 넘어가고, 방향 없는 이동(폼 저장 후 이동, 브라우저 뒤로 가기)은 살짝 겹쳐 바뀐다.
const PAGE = { "nav-forward": "nav-forward", "nav-back": "nav-back", default: "auto" };

export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition enter={PAGE} exit={PAGE} default="none">
      {children}
    </ViewTransition>
  );
}

// 화면의 <main>. 모든 page.tsx는 이걸로 감싸서 화면이 바뀔 때 자연스럽게 넘어가게 한다.
export function Page({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <PageTransition>
      <main className={className}>{children}</main>
    </PageTransition>
  );
}

// 불러온 내용을 살짝 떠오르며 보여 준다. 로딩 화면(Suspense fallback)에서 내용으로 바뀔 때 쓴다.
// CSS는 globals.css의 .reveal
export function Reveal({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return <div className={`reveal ${className}`}>{children}</div>;
}

// 같은 화면 안의 보기 전환. key가 바뀌면 이전 내용은 밀려 나가고 새 내용이 옆에서 들어온다.
// view-zoom: 주 ↔ 월처럼 같은 날짜를 크게·작게 볼 때. 옆이 아니라 확대·축소하듯 바뀐다.
const VIEW = {
  "view-forward": "nav-forward",
  "view-back": "nav-back",
  "view-zoom": "view-zoom",
  default: "none",
};

export function SlideView({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition enter={VIEW} exit={VIEW} default="none">
      {children}
    </ViewTransition>
  );
}
