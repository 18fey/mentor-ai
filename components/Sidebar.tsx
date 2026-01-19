// components/Sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isClassroom } from "@/lib/featureFlags";

type MenuItem = {
  label: string;
  path: string;
  badge?: string;
  hideInClassroom?: boolean; // 授業では隠したいものだけ true
};

type MenuSection = {
  title?: string;
  items: MenuItem[];
};

const sections: MenuSection[] = [
  {
    title: "基本",
    items: [
      { label: "ホーム", path: "/" },
      { label: "プロフィール", path: "/profile" },
    ],
  },
  {
    title: "応用ツール",
    items: [
      { label: "ケース面接AI", path: "/case" },
      { label: "フェルミ推定AI", path: "/fermi" },
      { label: "一般面接（模擬）", path: "/general" },
      { label: "ES", path: "/es" },
      { label: "業界インサイト", path: "/industry" },
    ],
  },
  {
    title: "その他",
    items: [
      {
        label: "AI思考タイプ診断",
        path: "/diagnosis-16type",
        badge: "NEW",
      },
      { label: "AI思考力トレーニング", path: "/mentor-ai-index" },
       {
        label: "Growth Inbox",
        path: "/growth",
      },


      // ↓↓↓ ここ3つは授業では隠す ↓↓↓
      {
        label: "サービス概要",
        path: "/service",
        hideInClassroom: true,
      },
      {
        label: "プラン・料金",
        path: "/pricing",
        hideInClassroom: true,
      },
      {
        label: "設定",
        path: "/settings",
        hideInClassroom: true,
      },
      // ↑↑↑ ここまで授業では非表示 ↑↑↑

      { label: "ケースガイド", path: "/case-guide" },
      { label: "フェルミガイド", path: "/fermi-guide" },

      { label: "AI思考力トレーニング初心者向けガイド" , path :"/ai-training-guide" },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  // 授業モードのときは hideInClassroom が true の item を除外
  const visibleSections: MenuSection[] = sections.map((section) => ({
    ...section,
    items: section.items.filter(
      (item) => !(isClassroom && item.hideInClassroom)
    ),
  }));

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-white/40 bg-white/80 p-6 backdrop-blur-md">
      {/* ロゴ */}
      <div className="mb-8">
        <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
          Elite Career Platform
        </div>
        <div className="text-2xl font-semibold text-slate-900">Mentor.AI</div>
        <div className="mt-1 text-[11px] text-slate-400">
          就活 OS を AI が作る
        </div>
      </div>

      {/* メニュー */}
      <nav className="flex-1 space-y-5 text-sm">
        {visibleSections.map((section, idx) => (
          <div key={idx} className="space-y-1">
            {section.title && (
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                {section.title}
              </p>
            )}
            {section.items.map((item) => {
              const active =
                pathname === item.path ||
                (item.path !== "/" && pathname.startsWith(item.path));

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
          </div>
        ))}
      </nav>

      {/* フッター */}
      <div className="mt-auto text-[11px] text-slate-400">
        Nモード / v0.1.0
      </div>
    </aside>
  );
}
