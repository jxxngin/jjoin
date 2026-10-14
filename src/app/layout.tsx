import type { Metadata, Viewport } from "next";
import { Noto_Sans_KR } from "next/font/google";
import "./globals.css";

const notoSansKr = Noto_Sans_KR({
  variable: "--font-noto-sans-kr",
  subsets: ["latin"],
  preload: false,
});

export const metadata: Metadata = {
  title: "jjoin",
  description: "친구들과의 약속을 한곳에서 만들고 확인해요",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // globals.css의 배경색과 맞춘다.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fdf8f1" },
    { media: "(prefers-color-scheme: dark)", color: "#14100e" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${notoSansKr.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
