"use client";

import { useState } from "react";
import { loadKakaoMaps, searchPlaces, type KakaoPlace } from "@/lib/kakao-maps";

export type PlaceValue = {
  name: string;
  address: string;
  lat: string;
  lng: string;
  url: string;
};

const boxClass =
  "h-12 rounded-xl border border-zinc-300 bg-transparent px-4 outline-none focus:border-brand dark:border-zinc-700";

// 카카오맵에서 장소를 검색해 고른다. 검색하지 않고 입력한 이름만 저장할 수도 있다.
export function PlaceField({ defaultValue }: { defaultValue: PlaceValue }) {
  const [selected, setSelected] = useState<PlaceValue | null>(
    defaultValue.lat ? defaultValue : null,
  );
  const [query, setQuery] = useState(defaultValue.lat ? "" : defaultValue.name);
  const [results, setResults] = useState<KakaoPlace[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string>();

  async function search() {
    const keyword = query.trim();
    if (!keyword) return;

    setSearching(true);
    setError(undefined);
    try {
      const maps = await loadKakaoMaps();
      setResults(await searchPlaces(maps, keyword));
    } catch (e) {
      setError(e instanceof Error ? e.message : "장소를 검색하지 못했어요.");
    } finally {
      setSearching(false);
    }
  }

  function choose(place: KakaoPlace) {
    setSelected({
      name: place.place_name,
      address: place.road_address_name || place.address_name,
      lat: place.y,
      lng: place.x,
      url: place.place_url,
    });
    setResults(null);
  }

  function clear() {
    setQuery(selected?.name ?? "");
    setSelected(null);
  }

  return (
    <div className="flex flex-col gap-2">
      <input type="hidden" name="placeName" value={selected?.name ?? query.trim()} />
      <input type="hidden" name="placeAddress" value={selected?.address ?? ""} />
      <input type="hidden" name="placeLat" value={selected?.lat ?? ""} />
      <input type="hidden" name="placeLng" value={selected?.lng ?? ""} />
      <input type="hidden" name="placeUrl" value={selected?.url ?? ""} />

      {selected ? (
        <div className="flex items-center gap-3 rounded-xl border border-brand bg-brand/5 px-4 py-3">
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate font-medium">{selected.name}</span>
            <span className="truncate text-sm text-zinc-500">{selected.address}</span>
          </div>
          <button type="button" onClick={clear} className="shrink-0 text-sm text-zinc-500">
            변경
          </button>
        </div>
      ) : (
        <>
          <div className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                // 엔터로 폼이 제출되지 않고 검색되게 한다.
                if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  search();
                }
              }}
              maxLength={100}
              placeholder="예: 강남역 삼겹살"
              aria-label="장소"
              className={`${boxClass} min-w-0 flex-1`}
            />
            <button
              type="button"
              onClick={search}
              disabled={searching || !query.trim()}
              className="h-12 shrink-0 rounded-xl bg-zinc-100 px-4 font-medium disabled:opacity-50 dark:bg-zinc-900"
            >
              {searching ? "검색 중" : "검색"}
            </button>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          {results && (
            <ul className="flex max-h-72 flex-col overflow-y-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
              {results.length === 0 && (
                <li className="px-4 py-3 text-sm text-zinc-500">
                  검색 결과가 없어요. 입력한 이름 그대로 저장할 수도 있어요.
                </li>
              )}
              {results.map((place) => (
                <li key={place.id} className="border-b border-zinc-200 last:border-0 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={() => choose(place)}
                    className="flex w-full flex-col px-4 py-3 text-left active:bg-zinc-100 dark:active:bg-zinc-900"
                  >
                    <span className="font-medium">{place.place_name}</span>
                    <span className="text-sm text-zinc-500">
                      {place.road_address_name || place.address_name}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
