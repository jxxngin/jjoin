"use client";

import { useEffect, useRef, useState } from "react";
import { loadKakaoMaps } from "@/lib/kakao-maps";

export function PlaceMap({ lat, lng }: { lat: number; lng: number }) {
  const container = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    loadKakaoMaps()
      .then((maps) => {
        if (cancelled || !container.current) return;
        const position = new maps.LatLng(lat, lng);
        const map = new maps.Map(container.current, { center: position, level: 3 });
        new maps.Marker({ map, position });
      })
      .catch(() => setFailed(true));

    return () => {
      cancelled = true;
    };
  }, [lat, lng]);

  if (failed) return null;

  return (
    <div
      ref={container}
      className="h-48 w-full overflow-hidden rounded-xl bg-zinc-200 dark:bg-zinc-800"
    />
  );
}
