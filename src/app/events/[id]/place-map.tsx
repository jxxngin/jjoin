"use client";

import { useEffect, useRef, useState } from "react";
import { loadKakaoMaps } from "@/lib/kakao-maps";

export function PlaceMap({ lat, lng }: { lat: number; lng: number }) {
  const container = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let cancelled = false;

    loadKakaoMaps()
      .then((maps) => {
        if (cancelled || !container.current) return;
        const position = new maps.LatLng(lat, lng);
        const map = new maps.Map(container.current, { center: position, level: 3 });
        new maps.Marker({ map, position });
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));

    return () => {
      cancelled = true;
    };
  }, [lat, lng]);

  if (error) {
    return (
      <p className="rounded-xl bg-zinc-100 px-4 py-3 text-sm text-zinc-500 dark:bg-zinc-900">
        지도를 불러오지 못했어요. ({error})
      </p>
    );
  }

  return (
    <div
      ref={container}
      className="h-48 w-full overflow-hidden rounded-xl bg-zinc-200 dark:bg-zinc-800"
    />
  );
}
