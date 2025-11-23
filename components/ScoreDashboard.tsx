// components/ScoreDashboard.tsx
"use client";

import React, { useEffect, useState } from "react";

type SessionType = "case" | "fermi" | "interview" | "es";

type ScoreSummary = {
  overallScore: number;
  caseScore: number;
  fermiScore: number;
  interviewScore: number;
  esScore: number;
  recentSessions: {
    id: string;
    type: SessionType;
    title: string;
    score: number;
    createdAt: string;
  }[];
};

const DEMO_DATA: ScoreSummary = {
  overallScore: 88,
  caseScore: 86,
  fermiScore: 84,
  interviewScore: 91,
  esScore: 89,
  recentSessions: [
    {
      id: "1",
      type: "case",
      title: "新規事業の参入可否（人材サービス）",
      score: 92,
      createdAt: new Date().toISOString(),
    },
    {
      id: "2",
      type: "fermi",
      title: "都内のタクシー市場規模",
      score: 88,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    },
    {
      id: "3",
      type: "interview",
      title: "自己PR ロールプレイ（3分想定）",
      score: 91,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    },
    {
      id: "4",
      type: "es",
      title: "総合商社志望動機（400字）",
      score: 87,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
    },
  ],
};

const SKILL_ITEMS = [
  { label: "結論ファーストの徹底", value: 86 },
  { label: "ロジックの一貫性", value: 82 },
  { label: "具体例の具体度", value: 90 },
  { label: "深掘り質問への耐性", value: 78 },
  { label: "タイムマネジメント", value: 80 },
];

const HISTORY = [
  { label: "3週間前", value: 78 },
  { label: "2週間前", value: 82 },
  { label: "先週", value: 86 },
  { label: "今週", value: 89 },
];

export default function ScoreDashboard() {
  const [data, setData] = useState<ScoreSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [usingDemo, setUsingDemo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch("/api/score-dashboard", {
          method: "GET",
          cache: "no-store",
        });

        if (res.ok) {
          const json = (await res.json()) as ScoreSummary;
          setData(json);
          setUsingDemo(false);
        } else {
          // 404 など API 未実装時 → デモデータにフォールバック
          console.warn("API not ready, using demo data. status:", res.status);
          setData(DEMO_DATA);
          setUsingDemo(true);
          setError(
            "現在はサンプルデータで表示しています。本番環境では、あなたの実際のスコアがここに反映されます。"
          );
        }
      } catch (e) {
        console.error(e);
        setData(DEMO_DATA);
        setUsingDemo(true);
        setError(
          "現在はサンプルデータで表示しています。本番環境では、あなたの実際のスコアがここに反映されます。"
        );
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const renderScoreCard = (
    label: string,
    value: number,
    accent?: boolean
  ) => {
    return (
      <div
        className={`flex flex-col justify-between rounded-3xl border border-slate-100 bg-white/80 px-6 py-4 shadow-[0_10px_40px_rgba(15,23,42,0.04)] backdrop-blur ${
          accent ? "md:col-span-2" : ""
        }`}
      >
        <div className="text-xs font-medium text-slate-500">{label}</div>
        <div className="mt-2 flex items	end gap-2">
          <div className="text-2xl md:text-3xl font-semibold text-slate-900">
            {Math.round(value)}
          </div>
          <div className="mb-1 text-[11px] text-slate-400">/ 100</div>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-sky-400 to-emerald-400"
            style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="px-6 py-6 md:px-10 md:py-8">
      {/* ヘッダー */}
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-sky-600">
            SCORE DASHBOARD
          </p>
          <h1 className="mt-1 text-2xl md:text-3xl font-semibold tracking-tight text-slate-900">
            スコアダッシュボード
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            ケース・フェルミ・一般面接・ES添削など、それぞれのスコア推移や弱点領域を一覧で確認できる画面です。
            本番環境では、各セッションの実データをもとに自動集計されます。
          </p>
        </div>

        {usingDemo && (
          <div className="inline-flex items-center gap-2 self-start rounded-full border border-dashed border-sky-200 bg-sky-50/70 px-3 py-1 text-[11px] text-sky-700">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
            デモデータで表示中
          </div>
        )}
      </div>

      {/* ローディング */}
      {loading && (
        <div className="rounded-2xl border border-slate-100 bg-white/70 p-6 text-sm text-slate-500 shadow-sm">
          スコアを読み込み中です…
        </div>
      )}

      {/* データ表示 */}
      {!loading && data && (
        <>
          {/* 上部スコアカード */}
          <section className="mb-8 grid gap-4 md:grid-cols-4">
            {renderScoreCard("総合スコア", data.overallScore, true)}
            {renderScoreCard("ケース面接", data.caseScore)}
            {renderScoreCard("フェルミ推定", data.fermiScore)}
            {renderScoreCard("一般面接", data.interviewScore)}
            {renderScoreCard("ES添削", data.esScore)}
          </section>

          {/* 中段：スコア推移 + スキル別 */}
          <section className="mb-8 grid gap-6 xl:grid-cols-[3fr,2fr]">
            {/* スコア推移 */}
            <div className="rounded-3xl border border-slate-100 bg-white/80 p-6 shadow-[0_10px_40px_rgba(15,23,42,0.04)] backdrop-blur">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">
                    総合スコア推移（サンプル）
                  </h2>
                  <p className="mt-1 text-[11px] text-slate-500">
                    直近数週間の総合スコアの推移です。V2では日別・セッション別にも切り替え可能になります。
                  </p>
                </div>
              </div>

              <div className="mt-2 h-56 rounded-2xl bg-slate-50 relative overflow-hidden">
                <div className="absolute inset-4">
                  {/* グリッド */}
                  <div className="absolute inset-0 flex flex-col justify-between">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="h-px w-full bg-slate-200/70" />
                    ))}
                  </div>
                  {/* 棒グラフ風 */}
                  <div className="relative flex h-full items-end gap-4 px-3 pb-4">
                    {HISTORY.map((h) => (
                      <div
                        key={h.label}
                        className="flex flex-1 flex-col items-center"
                      >
                        <div className="flex w-full flex-1 items-end">
                          <div
                            className="w-full rounded-t-xl bg-gradient-to-t from-sky-200 to-sky-500"
                            style={{ height: `${Math.max(10, h.value)}%` }}
                          />
                        </div>
                        <div className="mt-1 text-center">
                          <p className="text-[10px] text-slate-500">
                            {h.label}
                          </p>
                          <p className="text-[11px] font-medium text-slate-700">
                            {h.value}%
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* スキル別分析 */}
            <div className="rounded-3xl border border-slate-100 bg-white/80 p-6 shadow-[0_10px_40px_rgba(15,23,42,0.04)] backdrop-blur">
              <h2 className="text-sm font-semibold text-slate-900">
                スキル別分析（サンプル）
              </h2>
              <p className="mt-1 text-[11px] text-slate-500">
                面接ログの内容から、Mentor.AI が算出したスキル指標です。弱めの項目は「今日のおすすめ対策」にも反映されます。
              </p>

              <div className="mt-4 space-y-3">
                {SKILL_ITEMS.map((s) => (
                  <div key={s.label}>
                    <p className="text-[11px] text-slate-600">{s.label}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-sky-400 to-emerald-400"
                          style={{ width: `${s.value}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-medium text-slate-700">
                        {s.value}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* 下段：最近のセッション + 使い方メモ */}
          <section className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2 rounded-3xl border border-slate-100 bg-white/80 p-6 shadow-[0_10px_40px_rgba(15,23,42,0.04)] backdrop-blur">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900">
                  最近のセッション
                </h2>
                <span className="text-xs text-slate-400">
                  直近 {data.recentSessions.length} 件
                </span>
              </div>
              <div className="mt-4 divide-y divide-slate-100">
                {data.recentSessions.length === 0 && (
                  <p className="py-4 text-sm text-slate-400">
                    まだスコア付きのセッションがありません。まずはケース・フェルミ・一般面接・ES添削AIを使ってみてください。
                  </p>
                )}

                {data.recentSessions.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between gap-4 py-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            s.type === "case"
                              ? "bg-emerald-50 text-emerald-700"
                              : s.type === "fermi"
                              ? "bg-indigo-50 text-indigo-700"
                              : s.type === "interview"
                              ? "bg-sky-50 text-sky-700"
                              : "bg-rose-50 text-rose-700"
                          }`}
                        >
                          {s.type === "case"
                            ? "ケース"
                            : s.type === "fermi"
                            ? "フェルミ"
                            : s.type === "interview"
                            ? "一般面接"
                            : "ES"}
                        </span>
                        <p className="truncate text-sm font-medium text-slate-900">
                          {s.title}
                        </p>
                      </div>
                      <p className="mt-1 text-xs text-slate-400">
                        {new Date(s.createdAt).toLocaleString("ja-JP", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-sm font-semibold text-slate-900">
                          {Math.round(s.score)}
                        </div>
                        <div className="text-[10px] text-slate-400">/ 100</div>
                      </div>
                      <div className="h-2 w-20 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-sky-400/90"
                          style={{
                            width: `${Math.min(Math.max(s.score, 0), 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-100 bg-gradient-to-br from-sky-50/80 via-white to-indigo-50/70 p-5 text-sm text-slate-700 shadow-[0_10px_40px_rgba(15,23,42,0.05)]">
              <h2 className="text-sm font-semibold text-slate-900">
                ダッシュボードの使い方
              </h2>
              <ul className="mt-3 space-y-2 text-xs leading-relaxed text-slate-600">
                <li>・各AIで回答→採点すると、自動的にここへ反映されます。</li>
                <li>・総合スコアは４領域の平均スコアです。</li>
                <li>
                  ・直近スコアが低い領域は、優先してトレーニングすると効率的です。
                </li>
                <li>
                  ・今後「週ごとの推移グラフ」「志望業界別の強み」なども追加予定です。
                </li>
              </ul>
            </div>
          </section>
        </>
      )}

      {error && (
        <p className="mt-4 text-[11px] text-slate-400">
          {error}
        </p>
      )}
    </div>
  );
}
