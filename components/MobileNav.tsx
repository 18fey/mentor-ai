// components/MobileNav.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isClassroom } from "@/lib/featureFlags";

type NavItem = {
  label: string;
  path: string;
};

const baseItems: NavItem[] = [
  { label: "ホーム", path: "/" },
  { label: "プロフィール", path: "/profile" },
  { label: "Growth", path: "/growth" },
  { label: "ES", path: "/es" },
  { label: "設定", path: "/settings" },
];

export function MobileNav() {
  const pathname = usePathname();

  // 授業モードなら「設定」は隠す（Sidebar と同じ思想）
  const items = isClassroom
    ? baseItems.filter((item) => item.path !== "/settings")
    : baseItems;

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 border-t border-slate-200 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-xl items-center justify-between px-4 py-2">
        {items.map((item) => {
          const active =
            pathname === item.path ||
            (item.path !== "/" && pathname.startsWith(item.path));

          return (
            <Link
              key={item.path}
              href={item.path}
              className="flex flex-1 flex-col items-center justify-center text-[11px]"
            >
              <span
                className={
                  active
                    ? "rounded-full bg-sky-500/10 px-2 py-0.5 text-[11px] font-semibold text-sky-600"
                    : "text-[11px] text-slate-500"
                }
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>

      {/* iPhone下部のセーフエリアに対応 */}
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
