// components/TypeDetailPremium.tsx
"use client";

import React, { useState } from "react";
import type { ThinkingTypeId } from "@/lib/careerFitMap";

type AxisScore = {
  strategic: number;
  analytical: number;
  intuitive: number;
  creative: number;
};

type Props = {
  thinkingTypeId: ThinkingTypeId;
  thinkingTypeNameJa: string;
  thinkingTypeNameEn: string;
  typeSummary: string;
  axisScore?: AxisScore;
  userContext?: string; // 任意：希望業界や就活状況を渡したかったら
};

export const TypeDetailPremium: React.FC<Props> = ({
  thinkingTypeId,
  thinkingTypeNameJa,
  thinkingTypeNameEn,
  typeSummary,
  axisScore,
  userContext,
}) => {
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsUpgrade, setNeedsUpgrade] = useState(false);

  const handleLoad = async () => {
    setLoading(true);
    setError(null);
    setNeedsUpgrade(false);

    try {
      const res = await fetch("/api/diagnosis-16type", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          thinkingTypeId,
          thinkingTypeNameJa,
          thinkingTypeNameEn,
          typeSummary,
          axisScore,
          userContext,
          mode: "deep",
        }),
      });

      if (res.status === 401) {
        setError("Deep解説を見るにはログインが必要です。");
        return;
      }

      if (res.status === 402) {
        setNeedsUpgrade(true);
        const data = await res.json().catch(() => null);
        setError(
          data?.error ||
            "16タイプのDeep解説は有料プラン限定機能です。"
        );
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "API error");
      }

      const data = await res.json();
      setDetail(data.result ?? "");
    } catch (e) {
      console.error(e);
      setError("Deep解説の取得に失敗しました。時間をおいて再度お試しください。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="mt-6 rounded-2xl border border-sky-100 bg-sky-50/70 p-4 shadow-sm shadow-sky-100">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">
            Deep Profile
          </p>
          <p className="text-sm text-slate-700">
            {thinkingTypeNameJa}（{thinkingTypeNameEn}）
            のタイプを、就活・キャリア視点でもう少し深く言語化します。
          </p>
        </div>
        <button
          type="button"
          onClick={handleLoad}
          disabled={loading}
          className="inline-flex items-center justify-center rounded-full bg-sky-600 px-4 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-sky-700 disabled:opacity-60"
        >
          {loading ? "生成中…" : "このタイプのDeep解説を見る"}
        </button>
      </div>

      {error && (
        <p className="mt-3 text-xs text-rose-600">
          {error}
          {needsUpgrade && (
            <>
              {" "}
              <a
                href="/pricing"
                className="font-semibold text-sky-700 underline-offset-2 hover:underline"
              >
                プランを見る
              </a>
            </>
          )}
        </p>
      )}

      {detail && (
        <div className="prose prose-sm mt-4 max-w-none text-slate-800 prose-headings:mt-4 prose-headings:mb-2 prose-p:my-1 prose-ul:my-1 prose-li:my-0.5">
          <pre className="whitespace-pre-wrap break-words bg-transparent p-0 text-sm leading-relaxed text-slate-800">
            {detail}
          </pre>
        </div>
      )}
    </section>
  );
};
