// src/components/UpgradeModal.tsx
"use client";

import React from "react";
import Link from "next/link";

type UpgradeModalProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  // API から来るとき undefined / null もありうるので広めに
  message?: string | null;
  /**
   * どの機能でロックがかかったか（例：'フェルミ推定AI', 'ケース面接AI'）
   * 渡ってきたらメッセージ文の中で使う
   */
  featureLabel?: string;
  primaryLabel?: string;
  secondaryLabel?: string;
};

export const UpgradeModal: React.FC<UpgradeModalProps> = ({
  open,
  onClose,
  title = "PROプランのご案内",
  message,
  featureLabel,
  primaryLabel = "PROプランにアップグレード",
  secondaryLabel = "あとで",
}) => {
  if (!open) return null;

  // 表示するメッセージをここで一本化しておく
  const displayMessage =
    message ??
    (featureLabel
      ? `${featureLabel}の無料利用回数を使い切りました。PROプランにアップグレードすると、回数制限なく利用できます。`
      : "無料プランでの利用回数を使い切りました。PROプランにアップグレードすると、回数制限なく利用できます。");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
              {displayMessage}
            </p>
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

        <div className="mt-3 flex flex-col gap-2 text-xs">
          <Link
            href="/settings" // プラン・料金 or 設定ページに飛ばす
            className="inline-flex w-full items-center justify-center rounded-full bg-violet-500 px-3 py-2 font-semibold text-white shadow-sm hover:bg-violet-600"
          >
            {primaryLabel}
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex w-full items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-2 font-medium text-slate-600 hover:bg-slate-50"
          >
            {secondaryLabel}
          </button>
        </div>

        <p className="mt-3 text-[10px] text-slate-400">
          ※ ケース面接AI・フェルミ推定AI・ES添削AIなど、PROプランでは回数制限なく利用できます。
        </p>
      </div>
    </div>
  );
};
