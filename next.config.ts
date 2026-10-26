import type { NextConfig } from "next";

type WebpackUse = string | { loader?: string } | null | undefined;
type WebpackRule = { oneOf?: WebpackRule[]; rules?: WebpackRule[]; use?: WebpackUse | WebpackUse[] } | null | undefined;

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // Next.js 보안 업그레이드 도우미(next upgrade --agent=security)로 올린 프로젝트라는 표시
    agentUpgrade: "security",
  },
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
  // Turbopack(네이티브 SWC)이 막힌 Windows에서 webpack으로 개발할 때만 같은 Tailwind 로더를 붙인다.
  // 사용: JJOIN_WEBPACK=1 npx next dev --webpack
  // (webpack 설정이 있으면 Next 16의 Turbopack 빌드가 멈추므로, Vercel 빌드에는 넣지 않는다)
  ...(process.env.JJOIN_WEBPACK && {
    webpack(config: { module: { rules: WebpackRule[] } }) {
      // Next가 CSS를 처리하는 규칙(css-loader를 쓰는 곳)마다 Tailwind를 가장 먼저 돌게 끝에 붙인다.
      const visit = (rules: WebpackRule[] = []) => {
        for (const rule of rules) {
          if (!rule) continue;
          visit(rule.oneOf);
          visit(rule.rules);
          const uses = Array.isArray(rule.use) ? rule.use : [];
          const loaderOf = (use: WebpackUse) => (typeof use === "string" ? use : (use?.loader ?? ""));
          if (uses.some((use) => /[\\/]css-loader[\\/]/.test(loaderOf(use)))) uses.push("@tailwindcss/turbopack");
        }
      };
      visit(config.module.rules);
      return config;
    },
  }),
};

export default nextConfig;
