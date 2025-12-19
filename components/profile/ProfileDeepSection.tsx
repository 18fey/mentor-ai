// components/profile/ProfileDeepSection.tsx
"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { LockBox } from "@/components/locks/LockBox";

const createBrowserSupabaseClient = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

type BrowserSupabaseClient = ReturnType<typeof createBrowserSupabaseClient>;

type ProfileGate = {
  plan: "free" | "pro" | null;
  meta_balance: number | null;
};

export function ProfileDeepSection() {
  const [supabase] = useState<BrowserSupabaseClient>(() =>
    createBrowserSupabaseClient()
  );

  const [loading, setLoading] = useState(true);
  const [isPro, setIsPro] = useState(false);
  const [metaBalance, setMetaBalance] = useState(0);

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      // ✅ subscriptions / meta_wallet は見ない。profiles(plan, meta_balance) に一本化。
      const { data: pRow, error } = await supabase
        .from("profiles")
        .select("plan, meta_balance")
        .eq("auth_user_id", user.id)
        .maybeSingle<ProfileGate>();

      if (error) console.error("deep profile load error:", error);

      const plan = (pRow?.plan ?? "free") as "free" | "pro";
      setIsPro(plan === "pro");
      setMetaBalance(pRow?.meta_balance ?? 0);
      setLoading(false);
    };

    void load();
  }, [supabase]);

  if (loading) {
    return (
      <section className="rounded-2xl border bg-white/70 p-6">
        Deepプロフィールを読み込み中...
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-2xl border bg-white/70 p-6">
      <h2 className="text-xl font-semibold">
        🔒 あなた専用 Mentor.AI（Deepプロフィール）
      </h2>

      <LockBox
        isPro={isPro}
        metaBalance={metaBalance}
        requiredMeta={500}
        onUseMeta={() => {
          // ✅ ここで /api/meta/use (RPC consume_meta_fifo) に繋ぐ
          alert("Meta消費APIをつなぐ箇所");
        }}
        onUpgradePlan={() => {
          window.location.href = "/plans";
        }}
      >
        <p className="text-sm text-slate-600">
          価値観・16タイプ診断・ストーリーカードをもとに、
          あなた専用のMentor.AIモデル「Your Model」を生成します。
        </p>
        {/* 実際には deep_profiles を読み書きするフォームをここに追加 */}
      </LockBox>
    </section>
  );
}
