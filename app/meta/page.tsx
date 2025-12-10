// app/meta/page.tsx
"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

// ブラウザ用 Supabase クライアント
const createBrowserSupabaseClient = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

type BrowserSupabaseClient = ReturnType<typeof createBrowserSupabaseClient>;

// /api/meta/checkout で受け取っている pack の型と揃える
type MetaPack = "meta_3" | "meta_7" | "meta_15";

// Supabase から取るプロフィールの一部（meta_balance）
type ProfileMetaBalanceRow = {
  meta_balance: number | null;
};

// -----------------------------
// 1. 機能ID（/api/meta/use と揃える）
// -----------------------------
type FeatureId =
  | "es_check"
  | "fermi"
  | "light_questions"
  | "interview_10"
  | "industry_insight"
  | "case_interview"
  | "fit_analysis"
  | "deep_16type"
  | "enterprise_qgen";

// 機能ごとの Meta 消費（/api/meta/use と同じ）
const FEATURE_META_COST: Record<FeatureId, number> = {
  es_check: 1,
  fermi: 1,
  light_questions: 1,
  interview_10: 3,
  industry_insight: 3,
  case_interview: 4,
  fit_analysis: 6,
  deep_16type: 10,
  enterprise_qgen: 10,
};

// シミュレーターに表示するラベル
const FEATURE_LIST: {
  id: FeatureId;
  label: string;
  note: string;
}[] = [
  {
    id: "es_check",
    label: "ES 添削（1本）",
    note: "ガクチカ・自己PR など 1 本あたり",
  },
  {
    id: "fermi",
    label: "フェルミ / ケース簡易（1問）",
    note: "軽めの思考力トレーニング",
  },
  {
    id: "light_questions",
    label: "一般面接 想定質問（ライト）",
    note: "ライト版の質問生成",
  },
  {
    id: "interview_10",
    label: "一般面接 想定質問 10 問パック",
    note: "1 社分の深め質問をまとめて",
  },
  {
    id: "industry_insight",
    label: "業界インサイト Deep",
    note: "1 業界あたりの深堀り",
  },
  {
    id: "case_interview",
    label: "ケース面接フル（1問）",
    note: "構造化〜フィードバックまで",
  },
  {
    id: "fit_analysis",
    label: "志望動機 Fit 分析",
    note: "企業 × あなたのフィット分析",
  },
  {
    id: "deep_16type",
    label: "16 タイプ診断 Deep レポート",
    note: "AI思考タイプの詳細レポート",
  },
  {
    id: "enterprise_qgen",
    label: "企業別ハイレベル質問生成",
    note: "外銀・コンサル等向けの高負荷生成",
  },
];

// -----------------------------
// 2. Meta パック UI 用
// -----------------------------
type PackUI = {
  id: MetaPack;
  label: string;
  priceHint: string;
  metaAmount: number;
  description: string;
  popular?: boolean;
};

const PACKS: PackUI[] = [
  {
    id: "meta_3",
    label: "ライト",
    priceHint: "目安：ES 添削などを少し試したい人向け",
    metaAmount: 3,
    description: "まずは Meta をお試しでチャージしたいときに。",
  },
  {
    id: "meta_7",
    label: "スタンダード",
    priceHint: "目安：選考期間 1〜2 週間分",
    metaAmount: 7,
    description: "ES・面接を何度か回していきたい人向けの基本パック。",
    popular: true,
  },
  {
    id: "meta_15",
    label: "ブースト",
    priceHint: "目安：本選考前の総仕上げに",
    metaAmount: 15,
    description: "短期間で一気に仕上げたいときの集中チャージ用。",
  },
];

function newFunction() {
    ;
}

export default function MetaPage() {
  const [supabase] = useState<BrowserSupabaseClient>(() =>
    createBrowserSupabaseClient()
  );

  const [balance, setBalance] = useState<number | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(true);
  const [processingPack, setProcessingPack] = useState<MetaPack | null>(null);
  const [error, setError] = useState<string | null>(null);

  // シミュレーター用：機能ごとの利用回数
  const [usagePlan, setUsagePlan] = useState<Record<FeatureId, number>>(() => ({
    es_check: 0,
    fermi: 0,
    light_questions: 0,
    interview_10: 0,
    industry_insight: 0,
    case_interview: 0,
    fit_analysis: 0,
    deep_16type: 0,
    enterprise_qgen: 0,
  }));

  // 残高取得
  useEffect(() => {
    const loadBalance = async () => {
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError) {
          console.error("supabase auth error:", authError);
        }

        if (!user) {
          setBalance(0);
          setLoadingBalance(false);
          return;
        }

        const { data, error } = await supabase
  .from("profiles")                           // ← 型引数を外す
  .select("meta_balance")
  .eq("id", user.id)
  .maybeSingle<ProfileMetaBalanceRow>();      // ← 必要ならここに型を付ける

if (error) {
  console.error("load meta_balance error:", error);
  setBalance(0);
} else {
  setBalance(data?.meta_balance ?? 0);        // data?.meta_balance を見る
}

      } catch (e) {
        console.error("load meta_balance throwable error:", e);
        setBalance(0);
      } finally {
        setLoadingBalance(false);
      }
    };

    void loadBalance();
  }, [supabase]);

  const safeBalance = balance ?? 0;

  // シミュレーター：合計必要 META を計算
  const totalPlannedMeta = (Object.keys(usagePlan) as FeatureId[]).reduce(
    (sum, fid) => sum + usagePlan[fid] * (FEATURE_META_COST[fid] ?? 0),
    0
  );

  const additionalNeeded = Math.max(0, totalPlannedMeta - safeBalance);

  const handleUsageChange = (featureId: FeatureId, value: string) => {
    const num = Number(value.replace(/[^0-9]/g, ""));
    const safeNum = isNaN(num) ? 0 : Math.min(num, 999);
    setUsagePlan((prev) => ({ ...prev, [featureId]: safeNum }));
  };

  const handlePurchase = async (packId: MetaPack) => {
    setError(null);
    setProcessingPack(packId);

    try {
      const res = await fetch("/api/meta/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pack: packId }),
      });

      const json = await res.json();

      if (!res.ok) {
        console.error("meta checkout error:", json);
        setError(json?.error ?? "決済セッションの作成に失敗しました。");
        setProcessingPack(null);
        return;
      }

      if (json.checkoutUrl) {
        window.location.href = json.checkoutUrl as string;
      } else {
        setError("決済 URL の取得に失敗しました。");
        setProcessingPack(null);
      }
    } catch (e: any) {
      console.error("meta checkout fetch error:", e);
      setError(e?.message ?? "エラーが発生しました。時間をおいて再度お試しください。");
      setProcessingPack(null);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#F5FAFF] to-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-10 lg:flex-row">
        {/* 左：残高・シミュレーター */}
        <section className="flex-1 space-y-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">
              Meta コイン
            </h1>
            <p className="mt-2 text-sm text-slate-600 md:text-base">
              Mentor.AI の Deep 機能を使うためのポイントです。
              必要な分だけチャージして、ES 添削・ケース対策・Deep レポートを自由に組み合わせできます。
            </p>
          </div>

          {/* 残高カード */}
          <div className="rounded-2xl border border-slate-100 bg-white/70 p-5 shadow-sm backdrop-blur">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  現在の残高
                </p>
                <p className="mt-2 text-3xl font-semibold tabular-nums text-slate-900">
                  {loadingBalance ? (
                    <span className="text-sm text-slate-400">読み込み中...</span>
                  ) : (
                    <>
                      {safeBalance}
                      <span className="ml-1 text-base font-normal text-slate-500">
                        META
                      </span>
                    </>
                  )}
                </p>
                {!loadingBalance && (
                  <p className="mt-1 text-xs text-slate-500">
                    Meta は各機能の実行時に自動で消費されます。
                  </p>
                )}
              </div>

              <button
                type="button"
                className="inline-flex items-center justify-center rounded-full border border-sky-200 bg-sky-500/90 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => handlePurchase("meta_15")}
                disabled={processingPack !== null}
              >
                スタンダードをチャージ
              </button>
            </div>

            <div className="mt-4 grid gap-3 text-xs text-slate-500 md:grid-cols-3">
              <div className="rounded-xl bg-slate-50 px-3 py-2">
                <p className="font-medium text-slate-700">使い道</p>
                <p className="mt-1">
                  ES 添削・ケース/フェルミ・業界インサイト・16タイプ Deep
                  など、一部の高負荷タスクで消費されます。
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 px-3 py-2">
                <p className="font-medium text-slate-700">有効期限</p>
                <p className="mt-1">
                  有効期限はありません。仕様変更がある場合は事前にお知らせします。
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 px-3 py-2">
                <p className="font-medium text-slate-700">注意事項</p>
                <p className="mt-1">
                  購入後の返金はできません。最初は少額パックからの利用をおすすめします。
                </p>
              </div>
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-xs text-red-700">
              {error}
            </div>
          )}

          {/* 必要Metaシミュレーター */}
          <div className="rounded-2xl border border-slate-100 bg-white/80 p-5 shadow-sm backdrop-blur">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  必要 Meta シミュレーター
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  「ES を◯本」「ケースを◯問」など、使いたい回数を入れると、
                  合計で何 META 必要かと、今の残高で足りるかが一目でわかります。
                </p>
              </div>
            </div>

            <div className="mt-4 max-h-[360px] space-y-2 overflow-auto rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-xs">
              {FEATURE_LIST.map((f) => {
                const cost = FEATURE_META_COST[f.id] ?? 0;
                const count = usagePlan[f.id];
                const subtotal = cost * count;

                return (
                  <div
                    key={f.id}
                    className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_80px_80px] items-center gap-2 rounded-lg bg-white/80 px-3 py-2"
                  >
                    <div>
                      <p className="text-[11px] font-medium text-slate-900">
                        {f.label}
                      </p>
                      <p className="text-[10px] text-slate-500">{f.note}</p>
                    </div>
                    <div className="text-[11px] text-slate-600">
                      1 回あたり{" "}
                      <span className="font-semibold">{cost} META</span>
                    </div>
                    <div>
                      <input
                        type="number"
                        min={0}
                        max={999}
                        value={count || ""}
                        onChange={(e) =>
                          handleUsageChange(f.id, e.target.value)
                        }
                        className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-right text-[11px] text-slate-900 outline-none ring-0 focus:border-sky-300 focus:ring-1 focus:ring-sky-200"
                        placeholder="0"
                      />
                    </div>
                    <div className="text-right text-[11px] text-slate-700">
                      合計{" "}
                      <span className="font-semibold">
                        {subtotal || 0} META
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 合計エリア */}
            <div className="mt-4 flex flex-col gap-2 rounded-xl bg-slate-900 px-4 py-3 text-xs text-slate-50 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-300">
                  計画中のタスクに必要な Meta
                </p>
                <p className="mt-1 text-lg font-semibold tabular-nums">
                  {totalPlannedMeta} META
                </p>
              </div>
              <div className="text-[11px] md:text-right">
                <p>
                  現在の残高：{" "}
                  <span className="font-semibold">{safeBalance} META</span>
                </p>
                {totalPlannedMeta === 0 ? (
                  <p className="mt-1 text-slate-300">
                    まず上の一覧で、使いたい回数を入力してみてください。
                  </p>
                ) : additionalNeeded <= 0 ? (
                  <p className="mt-1 text-emerald-200">
                    この予定は{" "}
                    <span className="font-semibold">現在の残高で実行可能</span>
                    です 🎉
                  </p>
                ) : (
                  <p className="mt-1 text-amber-200">
                    あと{" "}
                    <span className="font-semibold">
                      {additionalNeeded} META
                    </span>{" "}
                    追加チャージが必要です。
                    <br className="hidden md:block" />
                    下のパックから、足りない分をチャージできます。
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* 右：パック一覧 & 履歴プレースホルダー */}
        <section className="flex-1 space-y-6">
          {/* パック一覧 */}
          <div className="rounded-2xl border border-slate-100 bg-white/80 p-5 shadow-sm backdrop-blur">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Meta をチャージする
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  必要なときだけ購入できる「都度チャージ」型です。
                  決済は Stripe を利用して安全に処理されます。
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
              {PACKS.map((pack) => (
                <div
                  key={pack.id}
                  className={`relative flex flex-col justify-between rounded-2xl border bg-slate-50/80 p-4 ${
                    pack.popular
                      ? "border-sky-300 shadow-md shadow-sky-100"
                      : "border-slate-100"
                  }`}
                >
                  {pack.popular && (
                    <span className="absolute -top-2 right-3 rounded-full bg-sky-500 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm">
                      Most Popular
                    </span>
                  )}

                  <div>
                    <p className="text-xs font-medium text-slate-500">
                      {pack.label}
                    </p>
                    <p className="mt-1 text-xl font-semibold text-slate-900">
                      {pack.metaAmount} META
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {pack.priceHint}
                    </p>

                    <p className="mt-3 text-xs text-slate-600">
                      {pack.description}
                    </p>
                  </div>

                  <button
                    type="button"
                    className="mt-4 inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-900 shadow-sm transition hover:border-sky-300 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={() => handlePurchase(pack.id)}
                    disabled={processingPack !== null}
                  >
                    {processingPack === pack.id ? "処理中..." : "このパックを購入する"}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* 購入履歴プレースホルダー */}
          <div className="rounded-2xl border border-slate-100 bg-white/80 p-5 shadow-sm backdrop-blur">
            <div className="flex items-centerjustify-between">
              <h2 className="text-sm font-semibold text-slate-900">購入履歴</h2>
              <span className="text-[11px] text-slate-400">
                今後のアップデートで表示予定
              </span>
            </div>

            <div className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-6 text-center text-xs text-slate-500">
              Stripe の Webhook で決済成功を受け取り、残高に反映したあと、
              ここに「日時 / 金額 / 付与 META / ステータス」などの履歴が表示されます。
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
