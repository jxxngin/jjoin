import { AdBanner } from "@/components/ad-banner";
import { getAds } from "@/lib/ads";

const frame = "mx-auto w-full max-w-md px-4 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]";

// 로그인한 뒤 모든 화면 맨 아래에 고정되는 광고 배너.
// 화면 내용이 배너에 가리지 않게 같은 높이의 빈 칸을 문서 끝에 둔다.
// 화면이 옆으로 넘어가도 움직이지 않게 view-transition-name을 따로 준다. (globals.css)
export function AppFooter() {
  const ads = getAds();
  if (ads.length === 0) return null;

  return (
    <>
      <div aria-hidden="true" className={frame}>
        <div className="aspect-[1086/213] w-full" />
      </div>
      <footer
        className="fixed inset-x-0 bottom-0 z-30 bg-background/85 backdrop-blur"
        style={{ viewTransitionName: "app-footer" }}
      >
        <div className={frame}>
          <AdBanner ads={ads} />
        </div>
      </footer>
    </>
  );
}
