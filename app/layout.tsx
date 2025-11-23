// app/layout.tsx
import "./globals.css";
import type { ReactNode } from "react";
import type { Metadata } from "next";
import Sidebar from "../components/Sidebar";
import BetaFeedbackBox from "../components/BetaFeedbackBox";
import { Footer } from "../components/Footer";

export const metadata: Metadata = {
  title: "Mentor.AI",
  description: "エリートキャリアプラットフォーム",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="min-h-screen bg-gradient-to-br from-white via-[#F0F7FD] to-white">
        {/* 背景のブラーグラデーション */}
        <div className="pointer-events-none fixed inset-0 opacity-15">
          <div
            className="absolute left-1/4 top-0 h-96 w-96 rounded-full blur-3xl mix-blend-multiply animate-blob"
            style={{ backgroundColor: "#B7D9F7" }}
          />
          <div
            className="absolute right-1/4 top-0 h-96 w-96 rounded-full blur-3xl mix-blend-multiply animate-blob animation-delay-2000"
            style={{ backgroundColor: "#D4EBFA" }}
          />
          <div
            className="absolute bottom-0 left-1/2 h-96 w-96 rounded-full blur-3xl mix-blend-multiply animate-blob animation-delay-4000"
            style={{ backgroundColor: "#E8E8E8" }}
          />
        </div>

        {/* メインレイアウト（コンテンツ＋フッター） */}
        <div className="relative z-10 flex min-h-screen flex-col">
          {/* サイドバー＋ページ本体 */}
          <div className="flex flex-1">
            <Sidebar />
            <main className="flex-1 p-8 lg:p-12 xl:p-16">
              {children}
            </main>
          </div>

          {/* 共通フッター（利用規約・プライバシーなど） */}
          <Footer />
        </div>

        {/* ✅ β版フィードバックボックス（画面右下固定） */}
        <BetaFeedbackBox />
      </body>
    </html>
  );
}
