import type { Metadata } from "next";
import { Geist } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "뜰까 — 내 주변 상권 분석",
  description: "반경 내 상권을 한눈에 확인하세요. 음식점·카페·뷰티·의료 등 업종 분포와 상권 점수를 무료로 분석해드립니다.",
  keywords: ["상권 분석", "내 주변 상권", "상권 지도", "창업 입지 분석", "뜰까"],
  openGraph: {
    title: "뜰까 — 내 주변 상권 분석",
    description: "반경 내 상권을 한눈에 확인하세요. 업종 분포와 상권 점수를 무료로 분석해드립니다.",
    type: "website",
    locale: "ko_KR",
    siteName: "뜰까",
  },
  twitter: {
    card: "summary",
    title: "뜰까 — 내 주변 상권 분석",
    description: "반경 내 상권을 한눈에 확인하세요.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${geistSans.variable} h-full`}>
      <body className="h-full">
        {children}
        <Script
          src={`//dapi.kakao.com/v2/maps/sdk.js?appkey=${process.env.NEXT_PUBLIC_KAKAO_APP_KEY}&autoload=false&libraries=clusterer`}
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
