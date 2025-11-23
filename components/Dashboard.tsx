// components/Dashboard.tsx
"use client";

import React from "react";

type DashboardProps = {
  onNavigate?: (tab: string) => void;
};

export default function Dashboard({ onNavigate }: DashboardProps) {
  return (
    <div className="min-h-screen bg-[#F3F6FD] px-6 py-6 md:px-10 md:py-8">
      {/* ヘッダー */}
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-8">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-xs text-sky-600 shadow-sm border border-white/60 mb-2">
            <span className="inline-block h-2 w-2 rounded-full bg-sky-400" />
            Mentor.AI 就活ダッシュボード
          </div>
          <h1 className="text-2xl md:text-3xl font-semibold text-slate-900">
            ホーム
          </h1>
          <p className="mt-1 text-sm md:text-base text-slate-500">
            あなた専用の就活ダッシュボード。AIと一緒にケース・フェルミ・面接対策を進められます。
          </p>
        </div>

        <div className="flex items-center gap-3 self-start md:self-auto">
          <span className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-600 border border-sky-100">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            デモモード起動中
          </span>
          <div className="text-xs md:text-sm text-slate-500">
            更新: <span className="font-medium">14:07:50</span>
          </div>
        </div>
      </header>

      {/* デモモード通知 / CTA */}
      <section className="mb-8 rounded-3xl border border-white/70 bg-white/80 shadow-sm backdrop-blur-sm">
        <div className="flex flex-col gap-4 p-6 md:p-8">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-sky-500">
                Demo mode
              </p>
              <h2 className="mt-1 text-lg md:text-xl font-semibold text-slate-900">
                すべての機能を体験できるデモモードです
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                リアルなサンプルデータで操作感を確認できます。本番利用時はあなたのケース回答・スコアでダッシュボードが自動更新されます。
              </p>
            </div>
            <div className="flex flex-wrap gap-3 md:justify-end">
              <button
                className="inline-flex items-center justify-center rounded-full bg-sky-500 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-sky-600 transition"
                onClick={() => onNavigate?.("profile")}
              >
                接続を試す
              </button>
              <button
                className="inline-flex items-center justify-center rounded-full bg-white px-5 py-2 text-sm font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 transition"
                onClick={() => onNavigate?.("settings")}
              >
                セットアップガイド
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 text-xs md:text-sm text-slate-500">
            <span className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
              Interactive UI demonstration
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Realistic mock analysis results
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
              File upload simulation
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              Chart visualizations
            </span>
          </div>
        </div>
      </section>

      {/* 上部4カード */}
      <section className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DashboardStatCard
          label="利用回数"
          value="2"
          trendLabel="+12%"
          trendColor="text-emerald-500"
          iconBg="bg-sky-50"
        />
        <DashboardStatCard
          label="対策完了数"
          value="2"
          trendLabel="+8%"
          trendColor="text-emerald-500"
          iconBg="bg-violet-50"
        />
        <DashboardStatCard
          label="平均得点"
          value="90%"
          trendLabel="+5%"
          trendColor="text-emerald-500"
          iconBg="bg-amber-50"
        />
        <DashboardStatCard
          label="平均応答時間"
          value="12日"
          trendLabel="-2 days"
          trendColor="text-sky-500"
          iconBg="bg-emerald-50"
        />
      </section>

      {/* グラフエリア */}
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-2 mb-8">
        {/* 月別利用状況 */}
        <div className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-sm backdrop-blur-sm">
          <div className="mb-4 flex items中心 justify-between">
            <div>
              <h3 className="text-sm font-medium text-slate-900">
                月別利用状況
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                ケース・フェルミ・面接AIの合計利用回数
              </p>
            </div>
            <select className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600">
              <option>直近 6ヶ月</option>
              <option>直近 12ヶ月</option>
            </select>
          </div>

          {/* ダミー折れ線グラフ */}
          <div className="mt-2 h-52 rounded-2xl bg-slate-50 relative overflow-hidden">
            <div className="absolute inset-4">
              {/* グリッド線 */}
              <div className="absolute inset-0 flex flex-col justify-between">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-px w-full bg-slate-200/70" />
                ))}
              </div>
              {/* 擬似ライン */}
              <svg
                viewBox="0 0 300 120"
                className="h-full w-full text-sky-400"
                preserveAspectRatio="none"
              >
                <polyline
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points="5,90 55,60 105,75 155,40 205,55 255,30 295,45"
                />
                <defs>
                  <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <polygon
                  fill="url(#area)"
                  points="5,90 55,60 105,75 155,40 205,55 255,30 295,45 295,120 5,120"
                />
              </svg>
            </div>
            {/* X軸ラベル */}
            <div className="absolute bottom-2 left-4 right-4 flex justify-between text-[10px] text-slate-400">
              <span>1月</span>
              <span>2月</span>
              <span>3月</span>
              <span>4月</span>
              <span>5月</span>
              <span>6月</span>
            </div>
          </div>
        </div>

        {/* 重点対策分野 */}
        <div className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-sm backdrop-blur-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-slate-900">
                重点対策分野
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                最近よく使っているトレーニングモジュールの内訳
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-6 md:flex-row md:items-center">
            {/* ダミードーナツグラフ */}
            <div className="relative mx-auto h-32 w-32">
              <div className="absolute inset-0 rounded-full bg-slate-100" />
              <svg
                viewBox="0 0 36 36"
                className="h-full w-full rotate-[-90deg]"
              >
                <circle
                  cx="18"
                  cy="18"
                  r="15.5"
                  fill="transparent"
                  stroke="#e5e7eb"
                  strokeWidth="3"
                />
                <circle
                  cx="18"
                  cy="18"
                  r="15.5"
                  fill="transparent"
                  stroke="#38bdf8"
                  strokeWidth="3"
                  strokeDasharray="45 100"
                  strokeLinecap="round"
                />
                <circle
                  cx="18"
                  cy="18"
                  r="15.5"
                  fill="transparent"
                  stroke="#a855f7"
                  strokeWidth="3"
                  strokeDasharray="30 100"
                  strokeDashoffset="-45"
                  strokeLinecap="round"
                />
                <circle
                  cx="18"
                  cy="18"
                  r="15.5"
                  fill="transparent"
                  stroke="#22c55e"
                  strokeWidth="3"
                  strokeDasharray="25 100"
                  strokeDashoffset="-75"
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-4 rounded-full bg-white flex items-center justify-center">
                <div className="text-center">
                  <p className="text-[10px] text-slate-400">完了済み</p>
                  <p className="text-lg font-semibold text-slate-900">68%</p>
                </div>
              </div>
            </div>

            {/* 凡例 */}
            <div className="flex-1 space-y-2 text-xs">
              <LegendItem
                label="ケース面接AI"
                value="24 セッション"
                colorClass="bg-sky-400"
              />
              <LegendItem
                label="フェルミ推定AI"
                value="18 セッション"
                colorClass="bg-violet-400"
              />
              <LegendItem
                label="一般面接AI"
                value="12 セッション"
                colorClass="bg-emerald-400"
              />
            </div>
          </div>
        </div>
      </section>

      {/* 下部：おすすめセクションなど（簡易） */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-sm backdrop-blur-sm">
          <h3 className="text-sm font-medium text-slate-900 mb-2">
            今日のおすすめ対策
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            あなたのスコアと利用履歴をもとに、今日やると良いトレーニングを提案します。
          </p>
          <ul className="space-y-3 text-sm">
            <li className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
              <div>
                <p className="font-medium text-slate-900">
                  ケース面接：市場規模推定
                </p>
                <p className="text-xs text-slate-500">
                  ロジックは良好なので、数字の精度アップを重点的に。
                </p>
              </div>
              <span className="rounded-full bg-sky-100 px-3 py-1 text-[11px] font-medium text-sky-700">
                所要 20分
              </span>
            </li>
            <li className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
              <div>
                <p className="font-medium text-slate-900">
                  フェルミ：需要予測
                </p>
                <p className="text-xs text-slate-500">
                  分解の仕方はOK。仮定の置き方をもう一段丁寧に。
                </p>
              </div>
              <span className="rounded-full bg-violet-100 px-3 py-1 text-[11px] font-medium text-violet-700">
                所要 15分
              </span>
            </li>
          </ul>
        </div>

        <div className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-sm backdrop-blur-sm">
          <h3 className="text-sm font-medium text-slate-900 mb-2">
            直近のセッション履歴
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            デモデータとして、最近のセッション例を表示しています。本番利用ではあなたの実データに置き換わります。
          </p>
          <div className="space-y-3 text-sm">
            <HistoryRow
              type="ケース面接"
              title="新規事業の参入可否"
              score="92点"
              time="昨日"
            />
            <HistoryRow
              type="フェルミ推定"
              title="都内のタクシー市場規模"
              score="88点"
              time="2日前"
            />
            <HistoryRow
              type="一般面接"
              title="自己PR ロールプレイ"
              score="4.6 / 5"
              time="3日前"
            />
          </div>
        </div>
      </section>
    </div>
  );
}

type StatCardProps = {
  label: string;
  value: string;
  trendLabel: string;
  trendColor: string;
  iconBg: string;
};

function DashboardStatCard({
  label,
  value,
  trendLabel,
  trendColor,
  iconBg,
}: StatCardProps) {
  return (
    <div className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-sm backdrop-blur-sm flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-2xl ${iconBg}`}
        >
          <span className="h-5 w-5 rounded-lg bg-white/80 shadow-sm" />
        </div>
        <span className={`text-xs font-medium ${trendColor}`}>
          {trendLabel}
        </span>
      </div>
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
      </div>
    </div>
  );
}

type LegendProps = {
  label: string;
  value: string;
  colorClass: string;
};

function LegendItem({ label, value, colorClass }: LegendProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${colorClass}`} />
        <span className="text-xs text-slate-600">{label}</span>
      </div>
      <span className="text-[11px] text-slate-400">{value}</span>
    </div>
  );
}

type HistoryProps = {
  type: string;
  title: string;
  score: string;
  time: string;
};

function HistoryRow({ type, title, score, time }: HistoryProps) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3">
      <div className="space-y-1">
        <p className="text-[11px] font-medium text-slate-500">{type}</p>
        <p className="text-sm font-medium text-slate-900">{title}</p>
        <p className="text-[11px] text-slate-400">{time}</p>
      </div>
      <span className="text-xs font-semibold text-slate-700">{score}</span>
    </div>
  );
}
