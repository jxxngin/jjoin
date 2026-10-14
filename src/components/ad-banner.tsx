"use client";

import Image from "next/image";
import { useState, useSyncExternalStore } from "react";
import type { Ad } from "@/lib/ads";

// 홈 하단 광고. 페이지를 열 때마다 하나를 무작위로 보여 준다.
// 누르면 copy는 값을 복사하고, link는 새 탭으로 연다.
// 목록은 서버가 환경 변수 ADS_JSON에서 읽어 넘겨준다. (src/lib/ads.ts)
// 이미지를 바꿀 때는 파일 이름의 버전(-v2)도 올린다. 같은 이름이면 브라우저·이미지 캐시에 예전 그림이 남는다.

// 이미지 비율 1086×213
const WIDTH = 1086;
const HEIGHT = 213;

// 한 번 고른 광고는 페이지를 새로 열 때까지 유지한다. 서버는 고르지 않는다.
let chosen: number | null = null;
const noopSubscribe = () => () => {};
const pick = () => (chosen ??= Math.floor(Math.random() * 1_000_000));

export function AdBanner({ ads }: { ads: Ad[] }) {
  const roll = useSyncExternalStore(noopSubscribe, pick, () => null);
  const [message, setMessage] = useState<string | null>(null);

  if (ads.length === 0) return null;

  // 서버 렌더와 첫 화면에서는 자리만 잡아 둬서 레이아웃이 밀리지 않게 한다.
  if (roll === null) {
    return <div className="aspect-[1086/213] w-full" aria-hidden="true" />;
  }

  const ad = ads[roll % ads.length];
  const image = (
    <Image
      src={ad.src}
      alt={ad.alt}
      width={WIDTH}
      height={HEIGHT}
      sizes="(max-width: 448px) 100vw, 448px"
      className="h-auto w-full"
    />
  );

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
      {ad.action === "link" ? (
        <a
          href={ad.href}
          target="_blank"
          rel="noopener noreferrer"
          className="block transition active:scale-[0.99]"
        >
          {image}
        </a>
      ) : (
        <button
          type="button"
          onClick={() => copy(ad.value, ad.done)}
          className="block w-full transition active:scale-[0.99]"
        >
          {image}
        </button>
      )}
      <span className="pointer-events-none absolute top-1.5 right-1.5 rounded bg-black/40 px-1.5 py-0.5 text-[10px] font-semibold text-white">
        AD
      </span>
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
