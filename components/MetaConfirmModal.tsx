// components/MetaConfirmModal.tsx
"use client";

import React from "react";
import Link from "next/link";

type MetaConfirmModalProps = {
  open: boolean;
  onClose: () => void;

  // ✅ 旧UI互換（Fermiが使ってる形）
  featureLabel?: string;
  cost?: number; // = requiredMeta
  balance?: number | null;
  onConfirm?: () => void; // 「使う」
  onPurchase?: () => void; // 「購入する」押下時（任意）

  // ✅ 新UIにも対応（どっちでも動く）
  title?: string;
  message?: string;
  requiredMeta?: number;
  mode?: "confirm" | "purchase";
  confirmLabel?: string;
  cancelLabel?: string;
  purchaseLabel?: string;
};

export const MetaConfirmModal: React.FC<MetaConfirmModalProps> = ({
  open,
  onClose,

  featureLabel,
  cost,
  balance,
  onConfirm,
  onPurchase,

  title,
  message,
  requiredMeta,
  mode,
  confirmLabel = "METAを使って続行",
  cancelLabel = "キャンセル",
  purchaseLabel = "購入する",
}) => {
  if (!open) return null;

  // ✅ requiredMeta は (requiredMeta > cost > 1) の優先順位で決める
  const need = Number(requiredMeta ?? cost ?? 1);

  // ✅ mode が指定されてなければ、残高から自動判定
  const autoMode: "confirm" | "purchase" =
    typeof balance === "number" && balance < need ? "purchase" : "confirm";

  const m = mode ?? autoMode;

  const head =
    title ??
    (m === "confirm" ? "無料枠終了" : "METAが不足しています");

  const body =
    message ??
    (m === "confirm"
      ? `今月の無料枠を使い切りました。${featureLabel ? `（${featureLabel}）` : ""}\nこの実行で META を ${need} 消費します。続行しますか？`
      : `この実行には META が ${need} 必要です。購入して続行してください。`);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">{head}</h2>
            <p className="mt-1 whitespace-pre-line text-[11px] leading-relaxed text-slate-600">
              {body}
            </p>

            <div className="mt-2 space-y-1 text-[11px] text-slate-500">
              <div>
                必要META：<span className="font-semibold text-slate-800">{need}</span>
              </div>
              {typeof balance === "number" && (
                <div>
                  保有META：<span className="font-semibold text-slate-800">{balance}</span>
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="閉じる"
          >
            ×
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-2 text-xs">
          {m === "confirm" ? (
            <>
              <button
                type="button"
                onClick={onConfirm}
                className="inline-flex w-full items-center justify-center rounded-full bg-violet-500 px-3 py-2 font-semibold text-white shadow-sm hover:bg-violet-600"
              >
                {confirmLabel}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex w-full items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-2 font-medium text-slate-600 hover:bg-slate-50"
              >
                {cancelLabel}
              </button>
            </>
          ) : (
            <>
              {onPurchase ? (
                <button
                  type="button"
                  onClick={onPurchase}
                  className="inline-flex w-full items-center justify-center rounded-full bg-violet-500 px-3 py-2 font-semibold text-white shadow-sm hover:bg-violet-600"
                >
                  {purchaseLabel}
                </button>
              ) : (
                <Link
                  href="/pricing"
                  className="inline-flex w-full items-center justify-center rounded-full bg-violet-500 px-3 py-2 font-semibold text-white shadow-sm hover:bg-violet-600"
                >
                  {purchaseLabel}
                </Link>
              )}

              <button
                type="button"
                onClick={onClose}
                className="inline-flex w-full items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-2 font-medium text-slate-600 hover:bg-slate-50"
              >
                {cancelLabel}
              </button>
            </>
          )}
        </div>

        <p className="mt-3 text-[10px] text-slate-400">
          ※ PRO（サブスク）ならMETA消費は発生しません。
        </p>
      </div>
    </div>
  );
};
