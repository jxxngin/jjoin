import type { MetadataRoute } from "next";

// 홈 화면에 앱처럼 설치하기 위한 정보. 색은 globals.css의 라이트 배경과 맞춘다.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "jjoin",
    short_name: "jjoin",
    description: "친구들과의 약속을 한곳에서 만들고 확인해요",
    lang: "ko",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#fafaf9",
    theme_color: "#fafaf9",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // 안드로이드가 원·둥근 사각형으로 잘라 쓰는 아이콘. 로고를 가운데 75%에 넣었다.
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
