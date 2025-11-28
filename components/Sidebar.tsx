// components/Sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type MenuItem = {
  label: string;
  path: string;
  badge?: string;
};

const menu: MenuItem[] = [
  { label: "ホーム", path: "/" },
  { label: "ケース面接AI", path: "/case" },
  { label: "フェルミ推定AI", path: "/fermi" },
  { label: "一般面接AI", path: "/general" },
  { label: "ES添削AI", path: "/es" },
  { label: "業界インサイト", path: "/industry" },
  { label: "スコアダッシュボード", path: "/score" },

  // 🔹 AI診断・思考系
  {
    label: "AI思考タイプ診断",
    path: "/diagnosis-16type",
    badge: "NEW",
  },
  {
    label: "AI思考力トレーニング",
    path: "/mentor-ai-index",
  },

  // 🔹 公開情報（銀行・初見ユーザー向け）
  {
    label: "サービス概要",
    path: "/service",
  },
  {
    label: "プラン・料金",
    path: "/pricing",
  },

  // 🔹 各種設定・ガイド
  { label: "設定", path: "/settings" },
  { label: "プロフィール", path: "/profile" },
  { label: "ケースガイド", path: "/case-guide" },
  { label: "フェルミガイド", path: "/fermi-guide" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-white/40 bg-white/80 p-6 backdrop-blur-md">
      {/* ロゴエリア */}
      <div className="mb-8">
        <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
          Elite Career Platform
        </div>
        <div className="text-2xl font-semibold text-slate-900">Mentor.AI</div>
      </div>

      {/* メニュー */}
      <nav className="flex-1 space-y-1 text-sm">
        {menu.map((item) => {
          const active = pathname === item.path;
          return (
            <Link
              key={item.path}
              href={item.path}
              className={`flex items-center justify-between rounded-xl px-3 py-2 transition ${
                active
                  ? "bg-sky-500 text-white shadow-sm"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              <span>{item.label}</span>
              {item.badge && !active && (
                <span className="ml-2 rounded-full bg-sky-100 px-1.5 text-[10px] font-semibold text-sky-600">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* フッターバージョン表示など */}
      <div className="mt-auto text-[11px] text-slate-400">
        Nモード / v0.1.0
      </div>
    </aside>
  );
}
