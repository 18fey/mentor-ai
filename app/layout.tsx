// app/layout.tsx
import "./globals.css";
import type { ReactNode } from "react";
import type { Metadata } from "next";
import Sidebar from "../components/Sidebar";
import BetaFeedbackBox from "../components/BetaFeedbackBox";
import { Footer } from "../components/Footer";
import { AppHeader } from "../components/AppHeader";
import { MobileNav } from "../components/MobileNav"; // ← 追加！

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
      <body className="min-h-[100dvh] bg-gradient-to-br from-white via-[#F0F7FD] to-white">
        {/* 🔹運営者情報バー */}
        <div className="w-full border-b bg-white/90 py-2 text-center text-[11px] text-slate-600">
          運営：渡邉 花鈴（屋号：Mentor.AI）｜所在地：〒104-0061 東京都中央区銀座一丁目22番11号 銀座大竹ビジデンス 2F｜
          お問い合わせ：support@mentor-ai.net
        </div>

        {/* 背景のブラーグラデーション（元のまま） */}
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

        {/* メインレイアウト */}
        <div className="relative z-10 flex min-h-[100dvh] flex-col">
          <div className="flex flex-1">
            {/* 🖥 PC/タブレット以上だけ Sidebar を表示 */}
            <aside className="hidden md:block">
              <Sidebar />
            </aside>

            {/* 右側：ヘッダー + コンテンツ */}
            <div className="flex min-h-[100dvh] flex-1 flex-col">
              <AppHeader />
              {/* 📱 モバイルでは下タブ分の余白(padding-bottom)を確保 */}
              <main className="flex-1 p-4 pb-20 md:p-8 md:pb-8 lg:p-12 xl:p-16">
                {children}
              </main>
            </div>
          </div>

          <Footer />
        </div>

        {/* 📱 iPhone / モバイル専用の下ナビ */}
        <MobileNav />

        <BetaFeedbackBox />
      </body>
    </html>
  );
}
