"use client";

import Image from "next/image";
import { useEffect, useState, useSyncExternalStore } from "react";
import type { Ad } from "@/lib/ads";

// 하단 광고. 처음 보여 줄 광고는 무작위로 고르고, 몇 초마다 옆으로 밀려나며 다음 광고로 넘어간다.
// 누르면 copy는 값을 복사하고, link는 새 탭으로 연다.
// 목록은 서버가 환경 변수 ADS_JSON에서 읽어 넘겨준다. (src/lib/ads.ts)
// 이미지를 바꿀 때는 파일 이름의 버전(-v2)도 올린다. 같은 이름이면 브라우저·이미지 캐시에 예전 그림이 남는다.

// 이미지 비율 1086×213
const WIDTH = 1086;
const HEIGHT = 213;
// 한 광고를 보여 주는 시간
const INTERVAL_MS = 5000;
const SLIDE_MS = 500;

// 한 번 고른 첫 광고는 페이지를 새로 열 때까지 유지한다. 서버는 고르지 않는다.
let chosen: number | null = null;
const noopSubscribe = () => () => {};
const pick = () => (chosen ??= Math.floor(Math.random() * 1_000_000));

export function AdBanner({ ads }: { ads: Ad[] }) {
  const roll = useSyncExternalStore(noopSubscribe, pick, () => null);

  if (ads.length === 0) return null;

  // 서버 렌더와 첫 화면에서는 자리만 잡아 둬서 레이아웃이 밀리지 않게 한다.
  if (roll === null) {
    return <div className="aspect-[1086/213] w-full" aria-hidden="true" />;
  }

  // 첫 광고부터 한 바퀴 돌도록 순서를 돌려 둔다.
  const start = roll % ads.length;
  const ordered = [...ads.slice(start), ...ads.slice(0, start)];
  return ordered.length === 1 ? <AdFrame ads={ordered} /> : <AdCarousel ads={ordered} />;
}

// 여러 개면 옆으로 넘긴다. 마지막 다음에는 첫 광고를 한 장 더 붙여 두고,
// 거기까지 밀린 뒤 애니메이션 없이 맨 앞으로 되돌려서 끊김 없이 한 방향으로 돈다.
function AdCarousel({ ads }: { ads: Ad[] }) {
  const [index, setIndex] = useState(0);
  const [animate, setAnimate] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => {
      // 다른 탭을 보고 있을 때는 넘기지 않는다.
      if (document.hidden) return;
      setAnimate(true);
      // 움직임 줄이기 설정이면 transitionend가 없어 복사본에 머무르므로, 그때는 두 번째 광고로 바로 넘긴다.
      setIndex((i) => (i >= ads.length ? 1 : i + 1));
    }, INTERVAL_MS);
    return () => clearInterval(timer);
  }, [ads.length]);

  function handleTransitionEnd() {
    if (index === ads.length) {
      setAnimate(false);
      setIndex(0);
    }
  }

  const current = index % ads.length;

  return (
    <AdFrame
      ads={[...ads, ads[0]]}
      trackStyle={{
        transform: `translateX(-${index * 100}%)`,
        transition: animate ? `transform ${SLIDE_MS}ms ease-in-out` : "none",
      }}
      onTransitionEnd={handleTransitionEnd}
      hiddenFrom={ads.length}
    >
      <span className="pointer-events-none absolute inset-x-0 bottom-1.5 flex justify-center gap-1" aria-hidden="true">
        {ads.map((ad, i) => (
          <span
            key={ad.id}
            className={`h-1 rounded-full bg-white/90 shadow-sm transition-all duration-300 ${
              i === current ? "w-3" : "w-1 opacity-60"
            }`}
          />
        ))}
      </span>
    </AdFrame>
  );
}

function AdFrame({
  ads,
  trackStyle,
  onTransitionEnd,
  hiddenFrom,
  children,
}: {
  ads: Ad[];
  trackStyle?: React.CSSProperties;
  onTransitionEnd?: () => void;
  // 이 순서부터는 끊김 없이 돌리려고 붙인 복사본이라 화면 읽기 프로그램에서 숨긴다.
  hiddenFrom?: number;
  children?: React.ReactNode;
}) {
  const [message, setMessage] = useState<string | null>(null);

  async function copy(value: string, done: string) {
    try {
      await navigator.clipboard.writeText(value);
      setMessage(done);
      setTimeout(() => setMessage(null), 2000);
    } catch {
      // 클립보드가 막힌 브라우저에서는 값을 직접 보여 준다.
      window.prompt("아래 내용을 복사해 주세요", value);
    }
  }

  return (
    <aside className="relative overflow-hidden rounded-2xl">
      <div className="flex motion-reduce:!transition-none" style={trackStyle} onTransitionEnd={onTransitionEnd}>
        {ads.map((ad, i) => {
          const clone = hiddenFrom !== undefined && i >= hiddenFrom;
          const image = (
            <Image
              src={ad.src}
              alt={clone ? "" : ad.alt}
              width={WIDTH}
              height={HEIGHT}
              sizes="(max-width: 448px) 100vw, 448px"
              className="h-auto w-full"
            />
          );
          return (
            <div key={`${ad.id}-${i}`} className="w-full shrink-0" aria-hidden={clone || undefined}>
              {ad.action === "link" ? (
                <a
                  href={ad.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  tabIndex={clone ? -1 : undefined}
                  className="block transition active:scale-[0.99]"
                >
                  {image}
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => copy(ad.value, ad.done)}
                  tabIndex={clone ? -1 : undefined}
                  className="block w-full transition active:scale-[0.99]"
                >
                  {image}
                </button>
              )}
            </div>
          );
        })}
      </div>
      <span className="pointer-events-none absolute top-1.5 right-1.5 rounded bg-black/40 px-1.5 py-0.5 text-[10px] font-semibold text-white">
        AD
      </span>
      {children}
      {message && (
        <span
          role="status"
          className="pointer-events-none absolute inset-x-0 bottom-1.5 mx-auto w-fit rounded-full bg-stone-900/85 px-3 py-1 text-xs font-medium text-white"
        >
          ✓ {message}
        </span>
      )}
    </aside>
  );
}
