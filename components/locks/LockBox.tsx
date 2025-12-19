// components/locks/LockBox.tsx
"use client";

import React from "react";
import Link from "next/link";

type LockBoxProps = {
  isPro: boolean;
  metaBalance: number;
  requiredMeta: number;
  onUseMeta: () => void;
  onUpgradePlan: () => void; // ←呼び出し側で router.push("/pricing") にしてOK
  children: React.ReactNode;
};

export function LockBox({
  isPro,
  metaBalance,
  requiredMeta,
  onUseMeta,
  onUpgradePlan,
  children,
}: LockBoxProps) {
  const hasEnoughMeta = metaBalance >= requiredMeta;

  if (isPro) {
    return (
      <div className="relative rounded-xl border border-emerald-300 bg-emerald-50/60 p-4 space-y-3">
        <div className="text-xs font-semibold text-emerald-700">
          PROで解放済み
        </div>
        {children}
      </div>
    );
  }

  if (hasEnoughMeta) {
    return (
      <div className="relative rounded-xl border border-amber-300 bg-amber-50/60 p-4 space-y-3">
        <div className="flex justify-between items-center text-xs text-amber-700">
          <span>Metaを使って実行できます。</span>
          <span>
            残高: {metaBalance}（必要: {requiredMeta}）
          </span>
        </div>

        <button
          type="button"
          onClick={onUseMeta}
          className="px-3 py-1 rounded bg-amber-500 text-white text-sm"
        >
          実行する
        </button>

        <div className="pt-2 border-t border-amber-100 text-xs text-slate-500">
          PROならいつでも利用できます。
          <button type="button" onClick={onUpgradePlan} className="ml-2 underline">
            プランを見る
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3 opacity-70">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
        <span>🔒 有料機能</span>
      </div>
      <p className="text-xs text-slate-500">
        PRO、または Meta を用意すると解放されます。
      </p>

      <div className="flex flex-wrap gap-2 pt-2">
        <button
          type="button"
          onClick={onUpgradePlan}
          className="px-3 py-1 rounded bg-sky-500 text-white text-sm"
        >
          プランを見る
        </button>
        <Link
          href="/pricing"
          className="px-3 py-1 rounded border text-sm text-sky-600"
        >
          Metaをチャージする
        </Link>
      </div>
    </div>
  );
}
