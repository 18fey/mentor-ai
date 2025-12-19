// components/AppHeader.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

const createBrowserSupabaseClient = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

type Plan = "free" | "pro";

type SimpleUser = { email: string | null };

type ProfileRow = {
  meta_balance: number | null;
  plan: Plan | null;
};

type SupabaseClient = ReturnType<typeof createBrowserSupabaseClient>;

export function AppHeader() {
  const router = useRouter();

  const [supabase] = useState<SupabaseClient>(() => createBrowserSupabaseClient());

  const [user, setUser] = useState<SimpleUser | null>(null);
  const [meta, setMeta] = useState<number | null>(null);
  const [plan, setPlan] = useState<Plan>("free");
  const [loading, setLoading] = useState(true);

  // --- ユーザー & プロフィール読込（plan + meta） ---
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data } = await supabase.auth.getUser();
        const authUser = data.user;

        setUser({ email: authUser?.email ?? null });

        if (!authUser) {
          setMeta(null);
          setPlan("free");
          return;
        }

        // ✅ profiles は auth_user_id で引く（id と一致しない前提）
        const { data: profile, error } = await supabase
          .from("profiles")
          .select("meta_balance, plan")
          .eq("auth_user_id", authUser.id)
          .maybeSingle<ProfileRow>();

        if (error) {
          console.error("profile_load_error:", error);
          setMeta(null);
          setPlan("free");
          return;
        }

        setMeta(profile?.meta_balance ?? 0);
        setPlan((profile?.plan ?? "free") as Plan);
      } catch (e) {
        console.error("header_load_error:", e);
        setMeta(null);
        setPlan("free");
      } finally {
        setLoading(false);
      }
    };

    void load();
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

      {/* 右：Meta 残高 + Plan + ユーザー + ログアウト */}
      <div className="flex items-center gap-4">
        {/* META 残高 */}
        {loading ? (
          <div className="rounded-full bg-slate-100 px-3 py-1 text-[11px] text-slate-400">
            読み込み中…
          </div>
        ) : (
          meta !== null && (
            <button
              onClick={() => router.push("/pricing")}
              className="flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-semibold text-sky-700 shadow-sm transition hover:bg-sky-100"
            >
              <span className="flex items-center gap-1">
                <span>META</span>
                <span className="tabular-nums text-sky-900">{meta}</span>
              </span>

              {/* ✅ Plan表示（常時見える） */}
              <span className="h-3 w-px bg-sky-200/80" />
              <span className="text-[11px] font-medium text-slate-600">
                Plan: <span className="font-semibold text-slate-800">{plan.toUpperCase()}</span>
              </span>
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
