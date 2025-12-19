// app/pricing/page.tsx
"use client";

import { useState } from "react";

type MetaPack = "meta_3" | "meta_7" | "meta_15";
type ProPlan = "pro" | "elite";

export default function PricingPage() {
  const [loadingPack, setLoadingPack] = useState<MetaPack | null>(null);
  const [loadingPro, setLoadingPro] = useState<ProPlan | null>(null);

  const handleBuyPro = async (plan: ProPlan = "pro") => {
    try {
      setLoadingPro(plan);

      const res = await fetch("/api/subscription/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });

      if (!res.ok) {
        console.error(await res.text());
        alert("決済ページの生成に失敗しました。時間をおいて再度お試しください。");
        return;
      }

      const data = await res.json();
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        alert("決済URLの取得に失敗しました。");
      }
    } catch (e) {
      console.error(e);
      alert("エラーが発生しました。時間をおいて再度お試しください。");
    } finally {
      setLoadingPro(null);
    }
  };

  const handleBuyMeta = async (pack: MetaPack) => {
    try {
      setLoadingPack(pack);
      const res = await fetch("/api/meta/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pack }),
      });

      if (!res.ok) {
        console.error(await res.text());
        alert("決済ページの生成に失敗しました。時間をおいて再度お試しください。");
        return;
      }

      const data = await res.json();
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        alert("決済URLの取得に失敗しました。");
      }
    } catch (e) {
      console.error(e);
      alert("エラーが発生しました。時間をおいて再度お試しください。");
    } finally {
      setLoadingPack(null);
    }
  };

  const isAnyLoading = loadingPack !== null || loadingPro !== null;

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <section className="mb-10">
        <h1 className="text-2xl font-semibold text-slate-900">プラン・料金</h1>
        <p className="mt-2 text-sm text-slate-600">
          Mentor.AI は、まずは無料のライト版でお試しいただけます。より深い診断や
          Deepレポートを利用したい方は、Metaコインをご購入ください。
        </p>
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        {/* Free */}
        <div className="rounded-2xl border border-slate-100 bg-white/80 p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Free
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-900">¥0</p>
          <p className="mt-1 text-xs text-slate-600">
            まずはお試しで。16タイプ診断のライト版や基本機能を利用できます。
          </p>
          <ul className="mt-4 space-y-2 text-xs text-slate-700">
            <li>・16タイプ診断（ライト版）</li>
            <li>・業界マッチ（ライト版）</li>
            <li>・ES添削 / 面接AI は回数制限付き</li>
          </ul>
        </div>

        {/* Pro */}
        <div className="rounded-2xl border border-sky-200 bg-sky-50/80 p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">
            Pro
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-900">¥3980 / 月</p>
          <p className="mt-1 text-xs text-slate-600">
            月額サブスクで、Deep機能や保存機能をほぼ無制限に利用できるプランです。
          </p>

          <ul className="mt-4 space-y-2 text-xs text-slate-700">
            <li>・Deepレポートの読み放題</li>
            <li>・ES添削 / 面接AIの上限UP</li>
            <li>・成長ログ（Growth Inbox）の解放</li>
          </ul>

          <button
            type="button"
            onClick={() => handleBuyPro("pro")}
            disabled={isAnyLoading}
            className="mt-5 w-full rounded-full bg-sky-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-sky-700 disabled:opacity-60"
          >
            {loadingPro === "pro" ? "生成中…" : "Pro を購入する"}
          </button>

          <p className="mt-3 text-[11px] text-slate-500">
            決済には Stripe を利用します。支払い完了後、自動的に Pro が反映されます（Webhook 連携）。
          </p>
        </div>

        {/* Meta packs */}
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50/80 p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">
            Meta コイン
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-900">¥500 〜</p>
          <p className="mt-1 text-xs text-slate-600">
            必要な分だけ購入して、Deepレポートや高度なAI機能に使える前払いコイン。
          </p>

          <div className="mt-4 space-y-2 text-xs text-slate-700">
            <p>・3 Meta：Deepレポート数本分</p>
            <p>・7 Meta：集中対策セット向け</p>
            <p>・15 Meta：シーズン通して使いたい方向け</p>
          </div>

          <div className="mt-4 space-y-2">
            <button
              type="button"
              onClick={() => handleBuyMeta("meta_3")}
              disabled={isAnyLoading}
              className="w-full rounded-full bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60"
            >
              {loadingPack === "meta_3" ? "生成中…" : "3 Meta を購入（¥500）"}
            </button>
            <button
              type="button"
              onClick={() => handleBuyMeta("meta_7")}
              disabled={isAnyLoading}
              className="w-full rounded-full bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60"
            >
              {loadingPack === "meta_7" ? "生成中…" : "7 Meta を購入（¥1,000）"}
            </button>
            <button
              type="button"
              onClick={() => handleBuyMeta("meta_15")}
              disabled={isAnyLoading}
              className="w-full rounded-full bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60"
            >
              {loadingPack === "meta_15" ? "生成中…" : "15 Meta を購入（¥2,000）"}
            </button>
          </div>

          <p className="mt-4 text-[11px] text-slate-500">
            決済には Stripe を利用します。支払い完了後、自動的に Mentor.AI
            アカウントの Meta 残高が反映されます（Webhook で連携）。
          </p>
        </div>
      </section>

      <section className="mt-10 text-[11px] text-slate-500">
        <p>※表記の金額は現時点の想定です。実際の価格は運用時に調整してください。</p>
        <p>
          ※購入にはログインが必要です。未ログインの場合は途中でログイン画面に遷移します。
        </p>
      </section>
    </main>
  );
}
