import type { Metadata } from "next";
import { Geist } from "next/font/google";
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
      </body>
    </html>
  );
}
