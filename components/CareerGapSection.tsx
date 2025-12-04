// src/components/CareerGapSection.tsx
"use client";

import React, { useState } from "react";
import { INDUSTRIES, IndustryId, ThinkingTypeId } from "@/lib/careerFitMap";

type Props = {
  thinkingTypeId: ThinkingTypeId;
  thinkingTypeNameJa: string;
  thinkingTypeNameEn: string;
  typeDescription: string;
  initialDesiredIndustryId?: IndustryId;
};

export const CareerGapSection: React.FC<Props> = ({
  thinkingTypeId,
  thinkingTypeNameJa,
  thinkingTypeNameEn,
  typeDescription,
  initialDesiredIndustryId
}) => {
  const [desiredIndustryId, setDesiredIndustryId] = useState<IndustryId>(
    initialDesiredIndustryId ?? "consulting"
  );
  const [reason, setReason] = useState("");
  const [experience, setExperience] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/career-gap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          thinkingTypeId,
          thinkingTypeNameJa,
          thinkingTypeNameEn,
          typeDescription,
          desiredIndustryId,
          userReason: reason,
          userExperienceSummary: experience
        })
      });

      if (!res.ok) {
        throw new Error("API error");
      }

      const data = await res.json();
      setResult(data.result);
    } catch (e) {
      console.error(e);
      setError("ギャップ分析の生成に失敗しました。時間をおいて再度お試しください。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="mt-10 rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">
        志望業界とのギャップ分析（β）
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        あなたの思考タイプ
        <span className="font-medium">
          {`「${thinkingTypeNameJa} / ${thinkingTypeNameEn}」`}
        </span>
        と志望業界との相性をAIが分析します。
      </p>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <label className="block text-xs font-medium text-slate-700">
            志望業界
          </label>
          <select
            value={desiredIndustryId}
            onChange={(e) => setDesiredIndustryId(e.target.value as IndustryId)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
          >
            {INDUSTRIES.map((ind) => (
              <option key={ind.id} value={ind.id}>
                {ind.labelJa}
              </option>
            ))}
          </select>

          <label className="block text-xs font-medium text-slate-700">
            志望理由（任意）
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
            placeholder="例：グローバルな案件に関わりたい、経営に近い立場で仕事がしたい等"
          />

          <label className="block text-xs font-medium text-slate-700">
            ガクチカ・これまでの経験（任意）
          </label>
          <textarea
            value={experience}
            onChange={(e) => setExperience(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
            placeholder="例：ゼミプロジェクト・インターン・アルバイト経験など"
          />
        </div>

        <div className="flex flex-col justify-between space-y-4">
          <p className="text-xs text-slate-500">
            入力内容は分析にのみ利用されます。空欄でも問題ありません。
          </p>
          <button
            onClick={handleAnalyze}
            disabled={loading}
            className="inline-flex items-center justify-center rounded-full bg-sky-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-sky-700 disabled:opacity-60"
          >
            {loading ? "分析中…" : "ギャップ分析を生成する"}
          </button>
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-red-500">{error}</p>}

      {result && (
        <div className="prose prose-sm mt-6 max-w-none whitespace-pre-wrap text-slate-800">
          {result}
        </div>
      )}
    </section>
  );
};
