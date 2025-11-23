// app/fermi/page.tsx
"use client";

import React from "react";
import { StatCard } from "@/components/StatCard";
import { FermiEstimateAI } from "@/components/FermiEstimateAI";

export default function FermiPage() {
  const stats = [
    { label: "解いた問題数", value: "28問", helper: "これまでのフェルミ練習数（デモ）" },
    { label: "平均得点", value: "92点", helper: "直近問題の平均スコア（想定）" },
    { label: "成長度", value: "+15点", helper: "初回スコアからの伸び（想定）" },
  ];

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

      {/* 上の3カード（デモ統計） */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {stats.map((s) => (
          <StatCard
            key={s.label}
            label={s.label}
            value={s.value}
            helper={s.helper}
          />
        ))}
      </div>

      {/* 新フェルミ道場 UI 本体 */}
      <div className="rounded-3xl bg-white/80 shadow-sm px-6 py-6">
        <FermiEstimateAI />
      </div>
    </div>
  );
}


