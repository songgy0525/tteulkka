import type { Metadata } from "next";
import { Geist } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "뜰까 — 내 주변 상권 분석",
  description: "반경 내 상권을 한눈에 확인하세요",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${geistSans.variable} h-full`}>
      <body className="h-full">
        {children}
        <Script
          src="//dapi.kakao.com/v2/maps/sdk.js?appkey=08bfa7f8f6eb4809596d2b89a61d8843&autoload=false"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
