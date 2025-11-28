// components/AppHeader.tsx
"use client";

import { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useRouter } from "next/navigation";

type SimpleUser = {
  email: string | null;
};

export function AppHeader() {
  const supabase = createClientComponentClient();
  const router = useRouter();
  const [user, setUser] = useState<SimpleUser | null>(null);

  useEffect(() => {
    const loadUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUser({ email: data.user?.email ?? null });
    };
    loadUser();
  }, [supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/auth");
  };

  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-100 bg-white/70 px-8 backdrop-blur">
      {/* 左側：小さめロゴ */}
      <div className="flex flex-col">
        <span className="text-[10px] font-semibold tracking-[0.25em] text-slate-500">
          ELITE CAREER PLATFORM
        </span>
        <span className="text-sm font-semibold text-slate-900">Mentor.AI</span>
      </div>

      {/* 右側：ユーザー情報 + ログアウト */}
      <div className="flex items-center gap-3">
        {user?.email && (
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-100 text-xs font-semibold text-sky-700">
              {user.email[0]?.toUpperCase()}
            </div>
            <span className="max-w-[180px] truncate text-xs text-slate-600">
              {user.email}
            </span>
          </div>
        )}

        <button
          onClick={handleLogout}
          className="rounded-full border border-slate-200 px-4 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          ログアウト
        </button>
      </div>
    </header>
  );
}
