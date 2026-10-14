import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // 링크 미리보기 크롤러에게는 메타데이터를 <head>에 바로 넣어 준다. (src/lib/bots.ts와 같은 목록)
  htmlLimitedBots:
    /kakaotalk-scrap|facebookexternalhit|facebookcatalog|Twitterbot|Slackbot|Discordbot|TelegramBot|LinkedInBot|WhatsApp|Applebot|Yeti|Daum|Line\//i,
  // 광고 배너 이미지는 Supabase Storage의 공개 ads 저장소에서만 받는다.
  images: {
    remotePatterns: process.env.NEXT_PUBLIC_SUPABASE_URL
      ? [new URL(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/ads/**`)]
      : [],
  },
  // 서비스 워커는 항상 최신 파일을 받게 하고, 같은 출처의 스크립트만 실행하게 한다.
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
