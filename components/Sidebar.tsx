// components/Sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const menu = [
  { label: "ホーム", path: "/" },
  { label: "ケース面接AI", path: "/case" },
  { label: "フェルミ推定AI", path: "/fermi" },
  { label: "一般面接AI", path: "/general" },
  { label: "ES添削AI", path: "/es" },
  { label: "業界インサイト", path: "/industry" },
  { label: "スコアダッシュボード", path: "/score" },
  { label: "設定", path: "/settings" },
  { label: "プロフィール", path: "/profile" },
  { label: "ケースガイド", path: "/case-guide" },
  { label: "フェルミガイド", path: "/fermi-guide" },
  // ← 1つだけでOK
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 h-screen bg-white/80 backdrop-blur-md border-r border-white/40 p-6 flex flex-col">
      <div className="mb-8">
        <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
          Elite Career Platform
        </div>
        <div className="text-2xl font-semibold text-slate-900">Mentor.AI</div>
      </div>

      <nav className="space-y-1 text-sm flex-1">
        {menu.map((item) => (
          <Link
            key={item.path} // ← key は path でOK（重複さえなければ）
            href={item.path}
            className={`flex items-center rounded-xl px-3 py-2 transition ${
              pathname === item.path
                ? "bg-sky-500 text-white shadow-sm"
                : "text-slate-700 hover:bg-slate-100"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="mt-auto text-[11px] text-slate-400">
        Nモード / v0.1.0
      </div>
    </aside>
  );
}
