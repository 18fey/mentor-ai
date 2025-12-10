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

type SubStatus = {
  isPro: boolean;
};

type MetaWallet = {
  balance: number;
};

export function ProfileDeepSection() {
  const [supabase] = useState<BrowserSupabaseClient>(() =>
    createBrowserSupabaseClient()
  );
  const [sub, setSub] = useState<SubStatus | null>(null);
  const [wallet, setWallet] = useState<MetaWallet | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: subRow } = await supabase
        .from("subscriptions")
        .select("status")
        .eq("user_id", user.id)
        .maybeSingle();

      const { data: walletRow } = await supabase
        .from("meta_wallet")
        .select("balance")
        .eq("user_id", user.id)
        .maybeSingle();

      setSub({ isPro: subRow?.status === "active" });
      setWallet({ balance: walletRow?.balance ?? 0 });
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

  const metaBalance = wallet?.balance ?? 0;
  const isPro = sub?.isPro ?? false;

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
          // ここで Meta消費のAPIをつなぐ
          alert("Meta消費APIをつなぐ箇所");
        }}
        onUpgradePlan={() => {
          // プランページへ遷移
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
