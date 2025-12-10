"use client";

import React, { useState } from "react";
import {
  INDUSTRIES,
  IndustryId,
  ThinkingTypeId,
} from "@/lib/careerFitMap";
import { CareerGapResult } from "@/components/CareerGapResult";

type Props = {
  thinkingTypeId: ThinkingTypeId;
  thinkingTypeNameJa: string;
  thinkingTypeNameEn: string;
  typeDescription: string;
};

type Mode = "basic" | "deep";

export const CareerGapSectionMulti: React.FC<Props> = ({
  thinkingTypeId,
  thinkingTypeNameJa,
  thinkingTypeNameEn,
  typeDescription,
  
}) => {
  const [industry1, setIndustry1] = useState<IndustryId | "">("");
  const [industry2, setIndustry2] = useState<IndustryId | "">("");
  const [industry3, setIndustry3] = useState<IndustryId | "">("");

  const [userReason, setUserReason] = useState("");
  const [userExperienceSummary, setUserExperienceSummary] = useState("");

  const [loadingMode, setLoadingMode] = useState<Mode | null>(null);
  const [resultMarkdown, setResultMarkdown] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [needsUpgrade, setNeedsUpgrade] = useState(false);
  const [lastMode, setLastMode] = useState<Mode | null>(null);

  const desiredIndustryOptions = INDUSTRIES;

  const selectedIndustryIds = [
    industry1 || null,
    industry2 || null,
    industry3 || null,
  ].filter((v): v is IndustryId => Boolean(v));

  const disabledSubmit = selectedIndustryIds.length === 0 || !!loadingMode;

  const handleSubmit = async (mode: Mode) => {
    setLoadingMode(mode);
    setError(null);
    setNeedsUpgrade(false);

    try {
      if (selectedIndustryIds.length === 0) {
        setError("志望業界を1つ以上選んでください。");
        return;
      }

      const res = await fetch("/api/career-gap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          thinkingTypeId,
          thinkingTypeNameJa,
          thinkingTypeNameEn,
          typeDescription,
          desiredIndustryIds: selectedIndustryIds,
          userReason,
          userExperienceSummary,
          mode,
        }),
      });

      if (res.status === 401) {
        setError("キャリア相性レポートを見るにはログインが必要です。");
        return;
      }

      if (res.status === 402) {
        setNeedsUpgrade(true);
        const data = await res.json().catch(() => null);
        setError(
          data?.error ||
            "キャリア相性レポートのDeep版は有料機能です。"
        );
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "API error");
      }

      const data = await res.json();
      setResultMarkdown(data.result ?? "");
      setLastMode(mode);
    } catch (e) {
      console.error(e);
      setError(
        "キャリア相性レポートの生成に失敗しました。時間をおいて再度お試しください。"
      );
    } finally {
      setLoadingMode(null);
    }
  };

  return (
    <section className="mt-10 rounded-3xl border border-slate-100 bg-white/90 p-6 shadow-sm shadow-slate-100">
      <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">
            Career Match (BETA)
          </p>
          <h3 className="mt-1 text-sm font-semibold text-slate-900">
            志望業界との「マッチ・ギャップ」と作戦を出してもらう
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            あなたの思考タイプ「{thinkingTypeNameJa}
            ({thinkingTypeNameEn})」と、最大3つまでの志望業界を掛け合わせて、
            マッチ度とギャップ、これからの打ち手プランを整理します。
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-2xl bg-sky-50 px-3 py-2 text-xs text-sky-700">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-sky-600 text-[10px] font-semibold text-white">
            i
          </span>
          <span>
            ライト版は無料 / Deep版は Meta または Pro プランで利用できます。
          </span>
        </div>
      </div>

      {/* 志望業界選択 */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-700">
            志望業界 1 <span className="text-rose-500">(必須)</span>
          </label>
          <select
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none ring-0 focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            value={industry1}
            onChange={(e) => setIndustry1(e.target.value as IndustryId | "")}
          >
            <option value="">選択しない</option>
            {desiredIndustryOptions.map((ind) => (
              <option key={ind.id} value={ind.id}>
                {ind.labelJa}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-700">
            志望業界 2 <span className="text-slate-400">(任意)</span>
          </label>
          <select
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none ring-0 focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            value={industry2}
            onChange={(e) => setIndustry2(e.target.value as IndustryId | "")}
          >
            <option value="">選択しない</option>
            {desiredIndustryOptions.map((ind) => (
              <option key={ind.id} value={ind.id}>
                {ind.labelJa}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-700">
            志望業界 3 <span className="text-slate-400">(任意)</span>
          </label>
          <select
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none ring-0 focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            value={industry3}
            onChange={(e) => setIndustry3(e.target.value as IndustryId | "")}
          >
            <option value="">選択しない</option>
            {desiredIndustryOptions.map((ind) => (
              <option key={ind.id} value={ind.id}>
                {ind.labelJa}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 志望理由・ガクチカ */}
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-700">
            志望理由（ざっくりでOK）
          </label>
          <textarea
            className="min-h-[96px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none ring-0 focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            placeholder="例）IBで大きなお金が動く現場を見たい / 事業会社のM&Aに関わりたい など"
            value={userReason}
            onChange={(e) => setUserReason(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-700">
            ガクチカ・これまでの経験（任意）
          </label>
          <textarea
            className="min-h-[96px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none ring-0 focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            placeholder="例）長期インターン / サークル運営 / ボランティア など、簡単に箇条書きでもOK"
            value={userExperienceSummary}
            onChange={(e) => setUserExperienceSummary(e.target.value)}
          />
        </div>
      </div>

      {/* ボタン群 */}
      <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={disabledSubmit}
            onClick={() => handleSubmit("basic")}
            className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-slate-800 disabled:opacity-60"
          >
            {loadingMode === "basic"
              ? "ライト版を生成中…"
              : "ライト版でマッチ・ギャップを見る"}
          </button>

          <button
            type="button"
            disabled={disabledSubmit}
            onClick={() => handleSubmit("deep")}
            className="inline-flex items-center justify-center rounded-full bg-sky-600 px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-sky-700 disabled:opacity-60"
          >
            {loadingMode === "deep"
              ? "Deepレポート生成中…"
              : "Deepレポート（有料機能）を出す"}
          </button>
        </div>

        {lastMode && resultMarkdown && (
          <p className="text-[11px] text-slate-500">
            表示中のレポート：{" "}
            <span className="font-semibold text-slate-800">
              {lastMode === "basic" ? "ライト版" : "Deep版"}
            </span>
          </p>
        )}
      </div>

      {/* エラー & 課金導線 */}
      {error && (
        <div className="mt-4 rounded-2xl border border-rose-100 bg-rose-50/70 px-3 py-2 text-xs text-rose-700">
          <p>{error}</p>
          {needsUpgrade && (
            <p className="mt-1">
              <a
                href="/pricing"
                className="font-semibold text-rose-700 underline underline-offset-2"
              >
                プランを見る
              </a>
              <span className="mx-1 text-rose-400">/</span>
              <a
                href="/pricing#meta"
                className="font-semibold text-rose-700 underline underline-offset-2"
              >
                Metaコインをチャージする
              </a>
            </p>
          )}
        </div>
      )}

      {/* 結果表示エリア */}
      {resultMarkdown && (
        <div className="mt-6">
          <CareerGapResult markdown={resultMarkdown} />
        </div>
      )}
    </section>
  );
};
