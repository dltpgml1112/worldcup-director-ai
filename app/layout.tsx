import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "World Cup Director AI — 당신이 감독이라면?",
  description:
    "2026 월드컵을 다시 쓰는 몰입형 전술 시뮬레이터. 감독이 되어 전술을 짜고 선수를 배치해 역사를 바꿔라.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
