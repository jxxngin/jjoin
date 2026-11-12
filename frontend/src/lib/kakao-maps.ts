// 카카오맵 JavaScript SDK를 한 번만 불러온다. 브라우저에서만 쓴다.
// https://apis.map.kakao.com/web/guide/

export type KakaoPlace = {
  id: string;
  place_name: string;
  address_name: string;
  road_address_name: string;
  x: string; // 경도
  y: string; // 위도
  place_url: string;
};

// 이 앱에서 쓰는 SDK 기능만 적었다.
type KakaoMaps = {
  load(callback: () => void): void;
  LatLng: new (lat: number, lng: number) => unknown;
  Map: new (container: HTMLElement, options: { center: unknown; level: number }) => unknown;
  Marker: new (options: { map: unknown; position: unknown }) => unknown;
  services: {
    Status: { OK: string; ZERO_RESULT: string };
    Places: new () => {
      keywordSearch(
        query: string,
        callback: (result: KakaoPlace[], status: string) => void,
        options?: { size?: number },
      ): void;
    };
  };
};

declare global {
  interface Window {
    kakao?: { maps: KakaoMaps };
  }
}

let loading: Promise<KakaoMaps> | null = null;

export function loadKakaoMaps(): Promise<KakaoMaps> {
  if (loading) return loading;

  loading = new Promise((resolve, reject) => {
    const key = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
    if (!key) {
      reject(new Error("NEXT_PUBLIC_KAKAO_JS_KEY가 설정되지 않았어요."));
      return;
    }

    const script = document.createElement("script");
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${key}&libraries=services&autoload=false`;
    script.onload = () => window.kakao!.maps.load(() => resolve(window.kakao!.maps));
    script.onerror = () => {
      loading = null;
      reject(new Error("카카오맵을 불러오지 못했어요."));
    };
    document.head.appendChild(script);
  });

  return loading;
}

export function searchPlaces(maps: KakaoMaps, query: string): Promise<KakaoPlace[]> {
  return new Promise((resolve, reject) => {
    new maps.services.Places().keywordSearch(
      query,
      (result, status) => {
        if (status === maps.services.Status.OK) resolve(result);
        else if (status === maps.services.Status.ZERO_RESULT) resolve([]);
        else reject(new Error("장소를 검색하지 못했어요."));
      },
      { size: 10 },
    );
  });
}
