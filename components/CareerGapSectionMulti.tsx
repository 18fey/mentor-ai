// components/CareerGapSectionMulti.tsx
"use client";

import React, { useState } from "react";
import {
  INDUSTRIES,
  IndustryId,
} from "@/lib/careerFitMap";
import { CareerGapResult } from "./CareerGapResult";

type Props = {
  // 診断側の TypeId と union が違っても渡せるよう、string にしておく
  thinkingTypeId: string;
  thinkingTypeNameJa: string;
  thinkingTypeNameEn: string;
  typeSummary: string;
};

export const CareerGapSectionMulti: React.FC<Props> = ({
  thinkingTypeId,
  thinkingTypeNameJa,
  thinkingTypeNameEn,
  typeSummary,
}) => {
  const [selectedIds, setSelectedIds] = useState<(IndustryId | "")[]>([
    "",
    "",
    "",
  ]);
  const [userReason, setUserReason] = useState("");
  const [userExperience, setUserExperience] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string>("");

  const handleSelectChange = (index: number, value: string) => {
    const next = [...selectedIds];
    next[index] = (value || "") as IndustryId | "";
    setSelectedIds(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult("");

    const ids = selectedIds.filter((v): v is IndustryId => Boolean(v));

    if (ids.length === 0) {
      setError("少なくとも1つは志望業界を選んでください。");
      return;
    }

    try {
      setLoading(true);

      const res = await fetch("/api/career-gap", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          thinkingTypeId,
          thinkingTypeNameJa,
          thinkingTypeNameEn,
          typeDescription: typeSummary,
          desiredIndustryIds: ids,
          userReason,
          userExperienceSummary: userExperience,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "サーバーエラーが発生しました。");
      }

      const data = await res.json();
      setResult(data.result ?? "");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "エラーが発生しました。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="mt-8 rounded-2xl border border-sky-100 bg-sky-50/60 p-5 shadow-sm shadow-sky-100">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">
        Career Match (Beta)
      </p>
      <h3 className="mt-2 text-sm font-semibold text-slate-900">
        志望業界との「マッチ・ギャップ」と作戦をAIに出してもらう
      </h3>
      <p className="mt-1 text-xs text-slate-600">
        あなたは
        <span className="font-semibold">
          {thinkingTypeNameJa}（{thinkingTypeNameEn}）
        </span>
        タイプです。このタイプの特徴と、志望業界のカルチャーを突き合わせて、
        マッチ度・ギャップ・今からの打ち手をまとめます。
      </p>

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        {/* 志望業界セレクト */}
        <div className="grid gap-3 md:grid-cols-3">
          {selectedIds.map((value, idx) => (
            <div key={idx} className="space-y-1">
              <label className="text-[11px] font-medium text-slate-600">
                志望業界 {idx + 1}
                {idx === 0 && <span className="text-rose-500">（必須）</span>}
              </label>
              <select
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-200"
                value={value}
                onChange={(e) => handleSelectChange(idx, e.target.value)}
              >
                <option value="">選択しない</option>
                {INDUSTRIES.map((ind) => (
                  <option key={ind.id} value={ind.id}>
                    {ind.labelJa}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>

        {/* 志望理由 */}
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-slate-600">
            志望理由（ざっくりでOK）
          </label>
          <textarea
            className="min-h-[80px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-200"
            placeholder="例）IBで大きなお金が動く現場を見たい／事業会社のM&Aに関わりたい など"
            value={userReason}
            onChange={(e) => setUserReason(e.target.value)}
          />
        </div>

        {/* ガクチカ・経験 */}
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-slate-600">
            ガクチカ・これまでの経験（任意）
          </label>
          <textarea
            className="min-h-[80px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-200"
            placeholder="例）長期インターン／サークル運営／ゼミでの活動 など、簡単に箇条書きでもOK"
            value={userExperience}
            onChange={(e) => setUserExperience(e.target.value)}
          />
        </div>

        {error && (
          <p className="text-[11px] text-rose-600">
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3 border-t border-sky-100 pt-3">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-1 rounded-full bg-sky-500 px-4 py-1.5 text-[11px] font-medium text-white shadow-sm shadow-sky-200 hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "分析中…" : "志望業界とのマッチ・ギャップを見る"}
          </button>
          <p className="text-[10px] text-slate-500">
            ※ β版なので、内容はあくまで「作戦会議のたたき台」として使ってください。
          </p>
        </div>
      </form>

      {result && <CareerGapResult markdown={result} />}
    </section>
  );
};
