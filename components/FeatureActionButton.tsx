"use client";

import { useState } from "react";

type LockState = "free" | "meta" | "pro";

type FeatureId =
  | "es_check"
  | "interview_10"
  | "deep_16type";

type Props = {
  feature: FeatureId;
  label: string;
  lockState: LockState;
  metaCost?: number; // lockState === "meta" のとき必須
  onRun: () => Promise<void>; // 実際のAI処理（とりあえず console.log でOK）
  onRequireMetaTopUp?: () => void; // Meta不足時に呼ばれる
  onOpenPlanPage?: () => void; // Pro導線（/plans に飛ばすなど）
};

export function FeatureActionButton(props: Props) {
  const {
    feature,
    label,
    lockState,
    metaCost,
    onRun,
    onRequireMetaTopUp,
    onOpenPlanPage,
  } = props;

  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (loading) return;

    if (lockState === "pro") {
      // Pro限定：プランページへ
      onOpenPlanPage?.();
      return;
    }

    if (lockState === "free") {
      // 無料解放：そのまま実行
      setLoading(true);
      await onRun().finally(() => setLoading(false));
      return;
    }

    // lockState === "meta"
    if (!metaCost) return;
    setLoading(true);

    try {
      const res = await fetch("/api/meta/use", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feature }),
      });

      if (res.status === 402) {
        // Meta不足
        onRequireMetaTopUp?.();
        return;
      }

      if (!res.ok) {
        console.error("meta/use error", await res.json());
        return;
      }

      // Meta消費OK → 実際のAI処理へ
      await onRun();
    } finally {
      setLoading(false);
    }
  };

  const baseClass =
    "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition shadow-sm";
  const styleByState: Record<LockState, string> = {
    free: "bg-blue-600 text-white hover:bg-blue-700",
    meta: "bg-amber-500 text-white hover:bg-amber-600",
    pro: "bg-slate-200 text-slate-500 cursor-not-allowed",
  };

  return (
    <button
      type="button"
      disabled={loading || lockState === "pro"}
      onClick={handleClick}
      className={`${baseClass} ${styleByState[lockState]}`}
    >
      {lockState === "pro" && "🔒 "}
      {label}
      {lockState === "meta" && metaCost != null && (
        <span className="ml-2 text-xs bg-black/10 rounded-full px-2 py-0.5">
          {metaCost} Meta
        </span>
      )}
    </button>
  );
}
