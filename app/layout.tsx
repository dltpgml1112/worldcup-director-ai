import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "World Cup Director AI — What if YOU were the coach?",
  description:
    "An immersive World Cup tactical simulator. Replay real finals, command the tactical board, and rewrite history.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
