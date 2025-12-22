// components/AppHeader.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
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
  plan: Plan | null;
};

type SupabaseClient = ReturnType<typeof createBrowserSupabaseClient>;

async function fetchMetaBalance(): Promise<number> {
  const res = await fetch("/api/meta/balance", { cache: "no-store" });
  if (!res.ok) return 0;
  const json = (await res.json()) as { ok: boolean; balance?: number };
  return Number(json.balance ?? 0);
}

export function AppHeader() {
  const router = useRouter();

  const supabase = useMemo<SupabaseClient>(() => createBrowserSupabaseClient(), []);

  const [user, setUser] = useState<SimpleUser | null>(null);
  const [meta, setMeta] = useState<number | null>(null);
  const [plan, setPlan] = useState<Plan>("free");
  const [loading, setLoading] = useState(true);

  // ✅ ヘッダー情報をまとめて再取得する関数
  const refreshHeader = async () => {
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

      // plan は profiles から
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("plan")
        .eq("auth_user_id", authUser.id)
        .maybeSingle<ProfileRow>();

      if (error) {
        console.error("profile_load_error:", error);
        setPlan("free");
      } else {
        setPlan((profile?.plan ?? "free") as Plan);
      }

      // meta は source of truth（meta_lots→rpc→api）から
      const balance = await fetchMetaBalance();
      setMeta(balance);
    } catch (e) {
      console.error("header_load_error:", e);
      setMeta(null);
      setPlan("free");
    } finally {
      setLoading(false);
    }
  };

  // 初回ロード
  useEffect(() => {
    void refreshHeader();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ 購入完了などで meta を更新したい時に呼ぶイベント
  useEffect(() => {
    const handler = () => {
      void refreshHeader();
    };

    window.addEventListener("meta:refresh", handler);
    return () => window.removeEventListener("meta:refresh", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/auth");
  };

  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-100 bg-white/70 px-8 backdrop-blur">
      <div className="flex flex-col">
        <span className="text-[10px] font-semibold tracking-[0.25em] text-slate-500">
          ELITE CAREER PLATFORM
        </span>
        <span className="text-sm font-semibold text-slate-900">Mentor.AI</span>
      </div>

      <div className="flex items-center gap-4">
        {loading ? (
          <div className="rounded-full bg-slate-100 px-3 py-1 text-[11px] text-slate-400">
            読み込み中…
          </div>
        ) : (
          meta !== null && (
            <button
              onClick={() => router.push("/pricing")}
              className="flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-semibold text-sky-700 shadow-sm transition hover:bg-sky-100"
              title="クリックでプラン画面へ"
            >
              <span className="flex items-center gap-1">
                <span>META</span>
                <span className="tabular-nums text-sky-900">{meta}</span>
              </span>

              <span className="h-3 w-px bg-sky-200/80" />
              <span className="text-[11px] font-medium text-slate-600">
                Plan: <span className="font-semibold text-slate-800">{plan.toUpperCase()}</span>
              </span>
            </button>
          )
        )}

        {user?.email && (
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-100 text-xs font-semibold text-sky-700">
              {user.email[0]?.toUpperCase()}
            </div>
            <span className="max-w-[180px] truncate text-xs text-slate-600">{user.email}</span>
          </div>
        )}

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
