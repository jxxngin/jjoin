"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Ad } from "@/lib/ads";

// 하단 광고. 처음 보여 줄 광고는 무작위로 고르고, 몇 초마다 옆으로 밀려나며 다음 광고로 넘어간다. 손으로 밀어서 넘길 수도 있다.
// 누르면 copy는 값을 복사하고, link는 새 탭으로 연다.
// 목록은 서버가 환경 변수 ADS_JSON에서 읽어 넘겨준다. (src/lib/ads.ts)
// 이미지를 바꿀 때는 파일 이름의 버전(-v2)도 올린다. 같은 이름이면 브라우저·이미지 캐시에 예전 그림이 남는다.

// 이미지 비율 1086×213
const WIDTH = 1086;
const HEIGHT = 213;
// 한 광고를 보여 주는 시간
const INTERVAL_MS = 10000;
const SLIDE_MS = 700;

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

// 여러 개면 옆으로 넘긴다. 손가락(마우스)으로 밀어서 직접 넘길 수도 있다.
// 양 끝에 반대쪽 광고를 한 장씩 더 붙여 두고([마지막, ...광고, 처음]), 복사본까지 밀린 뒤
// 애니메이션 없이 진짜 자리로 옮겨서 어느 쪽으로 넘겨도 끊김 없이 돈다.
function AdCarousel({ ads }: { ads: Ad[] }) {
  const count = ads.length;
  // 0은 앞쪽 복사본(마지막 광고), 1~count가 진짜 광고, count+1은 뒤쪽 복사본(첫 광고)
  const [index, setIndex] = useState(1);
  const [animate, setAnimate] = useState(true);
  // 끌고 있는 거리(px). 끄는 동안에는 애니메이션 없이 손가락을 따라간다.
  const [drag, setDrag] = useState<number | null>(null);
  const dragStart = useRef<{ x: number; y: number; id: number } | null>(null);
  const moved = useRef(false);
  // 손으로 넘기면 자동 넘김 시계를 처음부터 다시 잰다.
  const [timerKey, setTimerKey] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      // 다른 탭을 보고 있을 때나 끄는 중에는 넘기지 않는다.
      if (document.hidden || dragStart.current) return;
      go(1);
    }, INTERVAL_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerKey]);

  // 움직임 줄이기 설정이면 transitionend가 없어 복사본에 머무를 수 있으므로, 넘길 때 먼저 진짜 자리로 바꿔 계산한다.
  function go(step: 1 | -1) {
    setAnimate(true);
    setIndex((i) => {
      const real = i <= 0 ? count : i >= count + 1 ? 1 : i;
      return real + step;
    });
  }

  function handleTransitionEnd() {
    if (index === 0 || index === count + 1) {
      setAnimate(false);
      setIndex(index === 0 ? count : 1);
    }
  }

  function onPointerDown(e: React.PointerEvent) {
    dragStart.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
    moved.current = false;
  }

  function onPointerMove(e: React.PointerEvent) {
    const start = dragStart.current;
    if (!start || start.id !== e.pointerId) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    // 세로로 더 많이 움직이면 화면 스크롤로 보고 놓아준다.
    if (!moved.current && Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 6) {
      dragStart.current = null;
      setDrag(null);
      return;
    }
    if (Math.abs(dx) > 6) {
      if (!moved.current) e.currentTarget.setPointerCapture(e.pointerId);
      moved.current = true;
    }
    if (moved.current) setDrag(dx);
  }

  function onPointerEnd(e: React.PointerEvent) {
    const start = dragStart.current;
    dragStart.current = null;
    if (!start || drag === null) {
      setDrag(null);
      return;
    }
    const width = e.currentTarget.getBoundingClientRect().width;
    // 폭의 15% 넘게 밀면 넘긴다. 덜 밀면 제자리로 돌아간다.
    if (Math.abs(drag) > width * 0.15) go(drag < 0 ? 1 : -1);
    else setAnimate(true);
    setDrag(null);
    setTimerKey((k) => k + 1);
  }

  const current = (((index - 1) % count) + count) % count;

  return (
    <AdFrame
      ads={[ads[count - 1], ...ads, ads[0]]}
      isClone={(i) => i === 0 || i === count + 1}
      trackStyle={{
        transform: `translateX(calc(-${index * 100}% + ${drag ?? 0}px))`,
        transition: animate && drag === null ? `transform ${SLIDE_MS}ms ease-in-out` : "none",
        touchAction: "pan-y",
      }}
      trackHandlers={{
        onTransitionEnd: handleTransitionEnd,
        onPointerDown,
        onPointerMove,
        onPointerUp: onPointerEnd,
        onPointerCancel: onPointerEnd,
        // 밀어서 넘긴 뒤 손을 뗄 때 광고가 눌리지 않게 한다.
        onClickCapture: (e) => {
          if (moved.current) {
            e.preventDefault();
            e.stopPropagation();
            moved.current = false;
          }
        },
        onDragStart: (e) => e.preventDefault(),
      }}
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
  trackHandlers,
  isClone = () => false,
  children,
}: {
  ads: Ad[];
  trackStyle?: React.CSSProperties;
  trackHandlers?: React.HTMLAttributes<HTMLDivElement>;
  // 끊김 없이 돌리려고 붙인 복사본은 화면 읽기 프로그램과 키보드 이동에서 뺀다.
  isClone?: (index: number) => boolean;
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
      <div className="flex select-none motion-reduce:!transition-none" style={trackStyle} {...trackHandlers}>
        {ads.map((ad, i) => {
          const clone = isClone(i);
          const image = (
            <Image
              src={ad.src}
              alt={clone ? "" : ad.alt}
              width={WIDTH}
              height={HEIGHT}
              sizes="(max-width: 448px) 100vw, 448px"
              draggable={false}
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
