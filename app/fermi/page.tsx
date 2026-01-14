// app/fermi/page.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { StatCard } from "@/components/StatCard";
import { FermiEstimateAI } from "@/components/FermiEstimateAI";

type FermiStats = {
  ok: boolean;
  solved: number;
  averageScore: number;
  growth: number;
};

async function fetchFermiStats(): Promise<FermiStats> {
  const r = await fetch("/api/stats/fermi", { cache: "no-store" });
  const j = (await r.json().catch(() => null)) as FermiStats | null;
  if (!r.ok || !j) {
    return { ok: false, solved: 0, averageScore: 0, growth: 0 };
  }
  return j;
}

export default function FermiPage() {
  const [stats, setStats] = useState<FermiStats>({
    ok: false,
    solved: 0,
    averageScore: 0,
    growth: 0,
  });
  const [loading, setLoading] = useState(true);

  const reloadStats = useCallback(async () => {
    setLoading(true);
    const s = await fetchFermiStats();
    setStats(s);
    setLoading(false);
  }, []);

  // 初回ロードで取得
  useEffect(() => {
    reloadStats();
  }, [reloadStats]);

  // 表示用に整形
  const statCards = useMemo(() => {
    const solved = loading ? "…" : `${stats.solved}問`;
    const avg = loading ? "…" : `${stats.averageScore}点`;

    // 成長度: +/- 表示
    const growthNum = stats.growth ?? 0;
    const growth =
      loading ? "…" : `${growthNum >= 0 ? "+" : ""}${growthNum}点`;

    return [
      { label: "解いた問題数", value: solved, helper: "累計（fermi_sessions 集計）" },
      { label: "平均得点", value: avg, helper: "全履歴の平均（0〜50換算）" },
      { label: "成長度", value: growth, helper: "初期10件平均との差 → 直近10件平均との差" },
    ];
  }, [stats, loading]);

  return (
    <div className="px-10 py-8 space-y-8">
      {/* タイトル */}
      <div>
        <h1 className="text-2xl font-semibold mb-1">フェルミ推定AI</h1>
        <p className="text-sm text-slate-500">
          総合商社・コンサル・外銀の面接で頻出のフェルミ推定を、
          「型」に沿ってトレーニングできるモジュールです。
          問題の再定義 → 要素分解 → 仮定 → 計算 → オーダーチェック までを一連の流れで練習します。
        </p>
      </div>

      {/* 上の3カード（実統計） */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {statCards.map((s) => (
          <StatCard key={s.label} label={s.label} value={s.value} helper={s.helper} />
        ))}
      </div>

      {/* 新フェルミ道場 UI 本体 */}
      <div className="rounded-3xl bg-white/80 shadow-sm px-6 py-6">
        {/* ✅ 評価完了後に stats を更新したいので、FermiEstimateAI にコールバックを渡す */}
        <FermiEstimateAI onEvaluated={reloadStats} />
      </div>
    </div>
  );
}
