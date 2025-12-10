// components/locks/LockBox.tsx
"use client";

type LockBoxProps = {
  isPro: boolean;
  metaBalance: number;
  requiredMeta: number;
  onUseMeta: () => void;
  onUpgradePlan: () => void;
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
  // 状態判定
  const hasEnoughMeta = metaBalance >= requiredMeta;

  if (isPro) {
    // Proは常に解放
    return (
      <div className="relative rounded-xl border border-emerald-300 bg-emerald-50/60 p-4 space-y-3">
        <div className="text-xs font-semibold text-emerald-700">
          Proプランで解放済み
        </div>
        {children}
      </div>
    );
  }

  if (hasEnoughMeta) {
    // Metaは足りていて、使うかどうか選べる
    return (
      <div className="relative rounded-xl border border-amber-300 bg-amber-50/60 p-4 space-y-3">
        <div className="flex justify-between items-center text-xs text-amber-700">
          <span>Metaを使ってこの機能を一時解放できます。</span>
          <span>
            残高: {metaBalance} Meta（必要: {requiredMeta} Meta）
          </span>
        </div>

        <button
          type="button"
          onClick={onUseMeta}
          className="px-3 py-1 rounded bg-amber-500 text-white text-sm"
        >
          Metaを使って解放する
        </button>

        <div className="pt-2 border-t border-amber-100 text-xs text-slate-500">
          Proプランなら、Meta消費なしでいつでも利用できます。
          <button
            type="button"
            onClick={onUpgradePlan}
            className="ml-2 underline"
          >
            プランを見る
          </button>
        </div>
      </div>
    );
  }

  // MetaもProも無い → 完全ロック
  return (
    <div className="relative rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3 opacity-70">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
        <span>🔒 有料機能（Deepプロフィール）</span>
      </div>
      <p className="text-xs text-slate-500">
        あなた専用のMentor.AIモデルを生成する機能です。
        Proプラン、または Metaをチャージすると解放されます。
      </p>

      <div className="flex flex-wrap gap-2 pt-2">
        <button
          type="button"
          onClick={onUpgradePlan}
          className="px-3 py-1 rounded bg-sky-500 text-white text-sm"
        >
          プランを見る
        </button>
        <a
          href="/meta"
          className="px-3 py-1 rounded border text-sm text-sky-600"
        >
          Metaをチャージする
        </a>
      </div>
    </div>
  );
}
