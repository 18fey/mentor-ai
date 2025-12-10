// components/AppHeader.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

// ブラウザ用 Supabase クライアントをつくるヘルパー
const createBrowserSupabaseClient = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

type SimpleUser = {
  email: string | null;
};

type ProfileMetaBalanceRow = {
  meta_balance: number | null;
};

type SupabaseClient = ReturnType<typeof createBrowserSupabaseClient>;

export function AppHeader() {
  const router = useRouter();

  // Supabase クライアントは useState で 1 回だけ生成
  const [supabase] = useState<SupabaseClient>(() =>
    createBrowserSupabaseClient()
  );

  const [user, setUser] = useState<SimpleUser | null>(null);
  const [meta, setMeta] = useState<number | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(true);

  // --- ユーザー情報読込 ---
  useEffect(() => {
    const loadUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUser({ email: data.user?.email ?? null });
    };
    void loadUser();
  }, [supabase]);

  // --- Meta 残高読込 ---
  useEffect(() => {
    const loadMeta = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setMeta(null);
          setLoadingMeta(false);
          return;
        }

        const { data } = await supabase
          .from("profiles")
          .select("meta_balance")
          .eq("id", user.id)
          .single<ProfileMetaBalanceRow>();

        setMeta(data?.meta_balance ?? 0);
      } catch (e) {
        console.error("meta_balance_load_error:", e);
        setMeta(null);
      } finally {
        setLoadingMeta(false);
      }
    };

    void loadMeta();
  }, [supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/auth");
  };

  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-100 bg-white/70 px-8 backdrop-blur">
      {/* 左：ロゴ */}
      <div className="flex flex-col">
        <span className="text-[10px] font-semibold tracking-[0.25em] text-slate-500">
          ELITE CAREER PLATFORM
        </span>
        <span className="text-sm font-semibold text-slate-900">Mentor.AI</span>
      </div>

      {/* 右：Meta 残高 + ユーザーアイコン + ログアウト */}
      <div className="flex items-center gap-4">
        {/* META 残高 */}
        {loadingMeta ? (
          <div className="rounded-full bg-slate-100 px-3 py-1 text-[11px] text-slate-400">
            META 読み込み中…
          </div>
        ) : (
          meta !== null && (
            <button
              onClick={() => router.push("/meta")}
              className="flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-semibold text-sky-700 shadow-sm transition hover:bg-sky-100"
            >
              <span>META</span>
              <span className="tabular-nums text-sky-900">{meta}</span>
            </button>
          )
        )}

        {/* ユーザー情報 */}
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

        {/* ログアウト */}
        <button
          onClick={handleLogout}
          className="rounded-full border border-slate-200 px-4 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
        >
          ログアウト
        </button>
      </div>
    </header>
  );
}
