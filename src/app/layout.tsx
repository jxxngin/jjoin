import type { Metadata, Viewport } from "next";
import { Noto_Sans_KR } from "next/font/google";
import { ServiceWorkerRegistration } from "@/components/service-worker";
import { THEME_SCRIPT } from "@/lib/theme";
import "./globals.css";

const notoSansKr = Noto_Sans_KR({
  variable: "--font-noto-sans-kr",
  subsets: ["latin"],
  preload: false,
});

export const metadata: Metadata = {
  // 링크 미리보기 이미지(opengraph-image.png)를 전체 주소로 만들 때 쓴다.
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://jjoin.vercel.app"),
  title: "jjoin",
  description: "친구들과의 약속을 한곳에서 만들고 확인해요",
  openGraph: {
    title: "jjoin",
    description: "친구들과의 약속을 한곳에서 만들고 확인해요",
    siteName: "jjoin",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "jjoin" }],
  },
  // 아이폰에서 홈 화면에 추가했을 때 앱 이름과 전체 화면 실행
  appleWebApp: { capable: true, title: "jjoin", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // globals.css의 배경색과 맞춘다.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafaf9" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0a09" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // 테마 스크립트가 서버 HTML에 없던 data-theme을 붙이므로 불일치 경고를 끈다.
    <html lang="ko" className={`${notoSansKr.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        {/* next/script의 beforeInteractive는 Next 런타임이 뜬 뒤에 실행돼 깜빡임이 생긴다.
            HTML을 읽는 즉시 실행되도록 그냥 인라인 스크립트로 넣는다. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
