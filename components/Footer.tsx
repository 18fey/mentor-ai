// src/components/Footer.tsx
import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t bg-white/70 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-4 text-xs text-slate-500 sm:flex-row">
        <div className="text-center sm:text-left">
          <div>© 2025 Mentor.AI</div>
          <div className="mt-1">
            運営：渡邉 花鈴（屋号：Mentor.AI）<br />
            所在地：〒104-0061 東京都中央区銀座一丁目22番11号 銀座大竹ビジデンス 2F
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <Link href="/pricing" className="hover:text-slate-800">
            プラン・料金
          </Link>
          <Link href="/terms" className="hover:text-slate-800">
            利用規約
          </Link>
          <Link href="/privacy" className="hover:text-slate-800">
            プライバシーポリシー
          </Link>
          <Link href="/legal" className="hover:text-slate-800">
            特定商取引法に基づく表記
          </Link>
        </div>
      </div>
    </footer>
  );
}
