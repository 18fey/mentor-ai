// src/components/Footer.tsx
import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t bg-white/70 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-4 text-xs text-slate-500 sm:flex-row">
        <span>© 2025 Mentor.AI</span>
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
