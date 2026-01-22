// app/pricing/page.tsx
"use client";

import { useState } from "react";

type MetaPack = "meta_3" | "meta_7" | "meta_15";
type ProPlan = "pro" | "elite";

export default function PricingPage() {
  const [loadingPack, setLoadingPack] = useState<MetaPack | null>(null);
  const [loadingPro, setLoadingPro] = useState<ProPlan | null>(null);

  // ✅ 追加：購入前同意（Meta / Pro 共通で使えるが、まずはMetaで効かせる）
  const [agree, setAgree] = useState(false);

  // ✅ ローンチ段階：Meta課金のみ（Proは準備中）
  const PRO_COMING_SOON = true;

  const handleBuyPro = async (plan: ProPlan = "pro") => {
    // ✅ 準備中は購入できない（フロントでブロック）
    if (PRO_COMING_SOON) {
      alert("Proプランは現在準備中です。公開までお待ちください。");
      return;
    }

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
    // ✅ 追加：購入前同意チェック
    if (!agree) {
      alert("購入前に、利用規約・返金ポリシー（Metaコイン）への同意が必要です。");
      return;
    }

    try {
      setLoadingPack(pack);
      const res = await fetch("/api/meta/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pack, agree }),
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
          {PRO_COMING_SOON ? "（※Proは現在準備中です）" : ""}
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
    まずは無料で体験。毎月の無料枠の範囲で、主要機能をご利用いただけます。
  </p>

  <ul className="mt-4 space-y-2 text-xs text-slate-700">
    <li>・ケース面接AI：毎月 3 回まで</li>
    <li>・ケース生成：毎月 4 回まで</li>
    <li>・フェルミ推定AI：毎月 3 回まで</li>
    <li>・フェルミ生成：毎月 4 回まで</li>
    <li>・一般面接（10問）：毎月 1 回まで</li>
    <li>・AI思考トレーニング：毎月 3 回まで</li>
    <li>・ES添削：毎月 3 回まで</li>
    <li>・企業研究：毎月 3 回まで</li>
  </ul>

  <p className="mt-4 text-[11px] text-slate-500">
    ※無料枠は毎月リセットされます。
  </p>
</div>


        {/* Pro (Coming Soon) */}
        <div className="relative rounded-2xl border border-sky-200 bg-sky-50/80 p-6 shadow-sm">
          <div className="absolute right-4 top-4 rounded-full bg-white/80 px-3 py-1 text-[11px] font-semibold text-sky-700 shadow-sm">
            準備中
          </div>

          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">
            Pro
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-900">—</p>

          {/* ✅ 箇条書きは一旦削除して、将来の方針だけ記載 */}
          <p className="mt-1 text-xs text-slate-600">
            月額で <span className="font-semibold">全機能を無制限</span> に使っていただけるプランとして提供予定です。
            生成結果の保存機能なども含めて、現在準備を進めています。
          </p>

          <button
            type="button"
            onClick={() => handleBuyPro("pro")}
            disabled
            className="mt-5 w-full cursor-not-allowed rounded-full bg-sky-600 px-4 py-2 text-xs font-semibold text-white shadow-sm opacity-60"
          >
            Coming soon
          </button>

          <p className="mt-3 text-[11px] text-slate-500">
            公開後にご案内します。
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

          {/* ✅ 追加：購入前の同意ボックス（Metaコイン用） */}
          <label className="mt-4 flex items-start gap-2 text-[11px] text-slate-600">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={agree}
              onChange={(e) => setAgree(e.target.checked)}
              disabled={isAnyLoading}
            />
            <span>
              利用規約・返金ポリシー（Metaコイン）を確認し、同意します。{" "}
              <a href="/terms" className="underline hover:text-slate-800">
                利用規約
              </a>
              {" ／ "}
              <a href="/refund" className="underline hover:text-slate-800">
                返金ポリシー（Metaコイン）
              </a>
            </span>
          </label>

          <div className="mt-4 space-y-2">
            <button
              type="button"
              onClick={() => handleBuyMeta("meta_3")}
              disabled={isAnyLoading || !agree}
              className="w-full rounded-full bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60"
            >
              {loadingPack === "meta_3" ? "生成中…" : "3 Meta を購入（¥500）"}
            </button>
            <button
              type="button"
              onClick={() => handleBuyMeta("meta_7")}
              disabled={isAnyLoading || !agree}
              className="w-full rounded-full bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60"
            >
              {loadingPack === "meta_7" ? "生成中…" : "7 Meta を購入（¥1,000）"}
            </button>
            <button
              type="button"
              onClick={() => handleBuyMeta("meta_15")}
              disabled={isAnyLoading || !agree}
              className="w-full rounded-full bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60"
            >
              {loadingPack === "meta_15" ? "生成中…" : "15 Meta を購入（¥2,000）"}
            </button>
          </div>

          <p className="mt-4 text-[11px] text-slate-500">
            決済には Stripe を利用します。支払い完了後、自動的に Mentor.AI
            アカウントの Meta 残高が反映されます（Webhook で連携）。
          </p>

          <p className="mt-2 text-[11px] text-slate-500">
            ※Metaコインは原則返金不可です。詳細は{" "}
            <a href="/refund" className="underline hover:text-slate-800">
              返金ポリシー（Metaコイン）
            </a>{" "}
            をご確認ください。
          </p>
        </div>
      </section>

      <section className="mt-10 text-[11px] text-slate-500">
        <p>※購入にはログインが必要です。未ログインの場合は途中でログイン画面に遷移します。</p>
        <p className="mt-2">
          関連ページ：{" "}
          <a href="/terms" className="underline hover:text-slate-800">
            利用規約
          </a>{" "}
          ｜{" "}
          <a href="/privacy" className="underline hover:text-slate-800">
            プライバシーポリシー
          </a>{" "}
          ｜{" "}
          <a href="/legal" className="underline hover:text-slate-800">
            特定商取引法に基づく表記
          </a>{" "}
          ｜{" "}
          <a href="/refund" className="underline hover:text-slate-800">
            返金ポリシー（Metaコイン）
          </a>
        </p>
      </section>
    </main>
  );
}
