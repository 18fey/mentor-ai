// src/components/ESCorrection.tsx
"use client";

import React, { useState, useEffect, useMemo } from "react";
import { createBrowserClient } from "@supabase/ssr";

/* ------------------------------
   Types
--------------------------------*/
type QuestionType =
  | "self_pr"
  | "gakuchika"
  | "why_company"
  | "why_industry"
  | "other";

type EsScore = {
  structure: number;
  logic: number;
  clarity: number;
  companyFit: number;
  lengthFit: number;
};

type EsFeedback = {
  summary: string;
  strengths: string[];
  improvements: string[];
  checklist: string[];
  sampleStructure: string;
};

const QUESTION_LABEL: Record<QuestionType, string> = {
  self_pr: "自己PR",
  gakuchika: "学生時代に力を入れたこと",
  why_company: "志望動機（企業）",
  why_industry: "志望動機（業界）",
  other: "その他",
};

// 🔗 ストーリーカード型
type StoryCard = {
  id: string;
  topicType:
    | "gakuchika"
    | "self_pr"
    | "why_company"
    | "why_industry"
    | "self_intro"
    | "general"
    | string;
  title: string;
  star: {
    situation: string;
    task: string;
    action: string;
    result: string;
  };
  learnings: string;
  axes: string[];
  isSensitive: boolean;
  createdAt: string;
};

/* ------------------------------
   Component
--------------------------------*/
export const ESCorrection: React.FC = () => {
  // ✅ v8: コンポーネント用 Supabase クライアント
  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  const [userId, setUserId] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [company, setCompany] = useState("");
  const [qType, setQType] = useState<QuestionType>("self_pr");
  const [limit, setLimit] = useState<number>(400);
  const [text, setText] = useState("");

  const [score, setScore] = useState<EsScore | null>(null);
  const [feedback, setFeedback] = useState<EsFeedback | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 🔒 ロック状態
  const [locked, setLocked] = useState(false);
  const [lockMessage, setLockMessage] = useState<string | null>(null);

  const charCount = text.trim().length;

  // ストーリーカード
  const [storyCards, setStoryCards] = useState<StoryCard[]>([]);
  const [cardsLoading, setCardsLoading] = useState(false);
  const [cardsError, setCardsError] = useState<string | null>(null);

  // プロ用：AIドラフト
  const [aiDraft, setAiDraft] = useState<string | null>(null);
  const [draftLoading, setDraftLoading] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  /* ------------------------------
   認証
  ------------------------------*/
  useEffect(() => {
    const run = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        setUserId(user?.id ?? null);
      } finally {
        setAuthLoading(false);
      }
    };
    run();
  }, [supabase]);

  /* ------------------------------
   ストーリーカード取得
  ------------------------------*/
  useEffect(() => {
    if (!userId) return;

    const fetchCards = async () => {
      setCardsLoading(true);
      setCardsError(null);

      try {
        const res = await fetch(
          `/api/story-cards?userId=${encodeURIComponent(userId)}`
        );

        if (!res.ok) {
          setCardsError("ストーリーカードの取得に失敗しました。");
          return;
        }

        const data = await res.json();
        const rows: any[] = Array.isArray(data.storyCards)
          ? data.storyCards
          : [];

        const mapped: StoryCard[] = rows.map((row: any) => {
          let axes: string[] = [];
          if (Array.isArray(row.axes)) {
            axes = row.axes.filter((v: any) => typeof v === "string");
          } else if (typeof row.axes === "string" && row.axes.length > 0) {
            axes = row.axes.split(",").map((s: string) => s.trim());
          }

          return {
            id: row.id,
            topicType: row.topic_type ?? "general",
            title: row.title ?? "",
            star: {
              situation: row.star_situation ?? "",
              task: row.star_task ?? "",
              action: row.star_action ?? "",
              result: row.star_result ?? "",
            },
            learnings: row.learnings ?? "",
            axes,
            isSensitive: row.is_sensitive ?? false,
            createdAt: row.created_at,
          };
        });

        setStoryCards(mapped);
      } catch {
        setCardsError("ネットワークエラーでカードを取得できませんでした。");
      } finally {
        setCardsLoading(false);
      }
    };

    fetchCards();
  }, [userId]);

  /* ------------------------------
   topic → qType 変換
  ------------------------------*/
  const mapTopicToQuestionType = (
    topic: StoryCard["topicType"]
  ): QuestionType => {
    if (topic === "gakuchika") return "gakuchika";
    if (topic === "self_pr" || topic === "self_intro") return "self_pr";
    if (topic === "why_company") return "why_company";
    if (topic === "why_industry") return "why_industry";
    return "other";
  };

  const topicLabelFromCard = (topic: StoryCard["topicType"]): string => {
    const qt = mapTopicToQuestionType(topic);
    return QUESTION_LABEL[qt];
  };

  /* ------------------------------
   カード → ひな型
  ------------------------------*/
  const buildTemplateFromCard = (card: StoryCard): string => {
    const lines: string[] = [];

    lines.push("【結論】");
    lines.push(card.learnings || "（結論を書く）");

    lines.push("");
    lines.push("【状況（S）】");
    lines.push(card.star.situation || "（状況を書く）");

    lines.push("");
    lines.push("【課題・役割（T）】");
    lines.push(card.star.task || "（課題を書く）");

    lines.push("");
    lines.push("【行動（A）】");
    lines.push(card.star.action || "（行動を書く）");

    lines.push("");
    lines.push("【結果（R）】");
    lines.push(card.star.result || "（結果を書く）");

    lines.push("");
    lines.push("【この経験から得たこと】");
    lines.push(card.learnings || "（学びを書く）");

    return lines.join("\n");
  };

  const handleApplyCardToEs = (card: StoryCard) => {
    setText(buildTemplateFromCard(card));
    setQType(mapTopicToQuestionType(card.topicType));
    setSelectedCardId(card.id);
    setAiDraft(null);
  };

  /* ------------------------------
   ES 評価
  ------------------------------*/
  const handleEvaluate = async () => {
    if (!text.trim()) return;
    if (!userId) {
      setErrorMessage("ログイン情報を確認できませんでした。");
      return;
    }

    setIsEvaluating(true);
    setErrorMessage(null);
    setScore(null);
    setFeedback(null);
    setLocked(false);
    setLockMessage(null);

    try {
      const res = await fetch("/api/es/eval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          text,
          company,
          qType,
          limit,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data?.feedback) {
        setErrorMessage(
          data?.message ??
            "AI添削に失敗しました。時間をおいて再度お試しください。"
        );
      } else {
        setScore(data.score ?? null);
        setFeedback(data.feedback ?? null);
        setLocked(Boolean(data.locked));
        setLockMessage(data.message ?? null);
      }
    } catch {
      setErrorMessage("ネットワークエラーが発生しました。");
    } finally {
      setIsEvaluating(false);
    }
  };

  /* ------------------------------
   AIドラフト生成（PRO想定）
  ------------------------------*/
  const handleGenerateDraft = async () => {
    if (!selectedCardId) {
      setErrorMessage("カードを1つ選択してください。");
      return;
    }

    setDraftLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/es/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyCardId: selectedCardId }),
      });

      const data = await res.json();

      if (!res.ok || !data?.draft) {
        setErrorMessage(data?.message ?? "ドラフト生成に失敗しました。");
      } else {
        setAiDraft(data.draft);
      }
    } catch {
      setErrorMessage("AIドラフト生成中にエラーが発生しました。");
    } finally {
      setDraftLoading(false);
    }
  };

  /* ------------------------------
   Render
  ------------------------------*/
  if (authLoading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-600">
        ログイン情報を読み込み中です…
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-600">
        ログイン状態を確認できませんでした。
      </div>
    );
  }

  return (
    <div className="flex h-full gap-6">
      {/* 左：入力 */}
      <div className="flex-1 space-y-6 overflow-y-auto pr-2">
        {/* Header */}
        <section className="rounded-2xl border bg-white/80 p-4 shadow-sm">
          <h1 className="mb-1 text-sm font-semibold">
            ES添削AI（構成・ロジックチェック）
          </h1>
          <p className="text-[11px] text-slate-600">
            ペーストしたESに対してAIが採点・改善ポイントを返します。
          </p>
        </section>

        {/* メタ情報 */}
        <section className="space-y-3 rounded-2xl border bg-white/80 p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-3 text-xs md:grid-cols-3">
            <div>
              <label className="mb-1 block text-[11px] text-slate-500">
                企業名（任意）
              </label>
              <input
                className="w-full rounded-full border bg-slate-50 px-3 py-1.5 text-xs"
                placeholder="例：三井物産 / マッキンゼー"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] text-slate-500">
                設問の種類
              </label>
              <select
                className="w-full rounded-full border bg-slate-50 px-3 py-1.5 text-xs"
                value={qType}
                onChange={(e) => setQType(e.target.value as QuestionType)}
              >
                {Object.entries(QUESTION_LABEL).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-[11px] text-slate-500">
                文字数目安
              </label>
              <input
                type="number"
                className="w-full rounded-full border bg-slate-50 px-3 py-1.5 text-xs"
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
              />
            </div>
          </div>
        </section>

        {/* ES 本文 */}
        <section className="space-y-2 rounded-2xl border bg-white/80 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold">ES本文</h2>
            <div className="text-[11px]">
              <span
                className={
                  charCount === 0
                    ? ""
                    : charCount < limit * 0.6 || charCount > limit * 1.4
                    ? "text-amber-600"
                    : "text-emerald-600"
                }
              >
                {charCount} 文字
              </span>{" "}
              / {limit}
            </div>
          </div>

          <textarea
            className="w-full min-h-[220px] rounded-2xl border bg-white px-3 py-2 text-xs"
            placeholder="ここにES本文をペーストするか、右側のカードからひな型を挿入できます。"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />

          <div className="flex justify-end">
            <button
              onClick={handleEvaluate}
              disabled={!text.trim() || isEvaluating}
              className={`rounded-full px-5 py-2 text-xs font-semibold ${
                !text.trim() || isEvaluating
                  ? "cursor-not-allowed bg-slate-200"
                  : "bg-violet-500 text-white hover:bg-violet-600"
              }`}
            >
              {isEvaluating ? "評価中…" : "AIに添削してもらう"}
            </button>
          </div>

          {errorMessage && (
            <p className="mt-2 text-[11px] text-rose-600">{errorMessage}</p>
          )}
        </section>

        {/* フィードバック */}
        {feedback && (
          <section className="space-y-4 rounded-2xl border bg-white/80 p-4 shadow-sm">
            <h2 className="text-xs font-semibold">フィードバック結果</h2>

            {/* スコア */}
            {score && (
              <div className="grid grid-cols-2 gap-2 text-[11px] md:grid-cols-5">
                <ScorePill label="構成" value={score.structure} />
                <ScorePill label="ロジック" value={score.logic} />
                <ScorePill label="わかりやすさ" value={score.clarity} />
                <ScorePill label="企業Fit" value={score.companyFit} />
                <ScorePill label="文字数Fit" value={score.lengthFit} />
              </div>
            )}

            {/* 要約（無料） */}
            <div className="rounded-xl bg-slate-50 p-3 text-[11px] whitespace-pre-wrap">
              {feedback.summary}
            </div>

            <div>
              <p className="mb-1 text-[11px] font-semibold text-emerald-700">
                良いポイント
              </p>
              <ul className="list-disc pl-4 text-[11px]">
                {feedback.strengths.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>

            {/* 🔒 PRO ロック部分 */}
            <div className="relative">
              <div
                className={
                  locked
                    ? "pointer-events-none space-y-4 rounded-xl border p-3 opacity-50 blur-[2px]"
                    : "space-y-4 rounded-xl border bg-slate-50/80 p-3"
                }
              >
                <div>
                  <p className="mb-1 text-[11px] font-semibold text-amber-700">
                    改善ポイント
                  </p>
                  <ul className="list-disc pl-4 text-[11px]">
                    {feedback.improvements.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <p className="mb-1 text-[11px] font-semibold">
                    最終チェックリスト
                  </p>
                  <ul className="list-disc pl-4 text-[11px]">
                    {feedback.checklist.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <p className="mb-1 text-[11px] font-semibold">
                    構成サンプル
                  </p>
                  <pre className="whitespace-pre-wrap rounded-xl bg-white p-3 text-[11px]">
                    {feedback.sampleStructure}
                  </pre>
                </div>
              </div>

              {locked && (
                <div className="absolute inset-0 flex flex-col items-center justify-center rounded-xl bg-white/80 backdrop-blur-sm">
                  <p className="mb-2 px-3 text-center text-[11px] text-slate-600">
                    {lockMessage ??
                      "この先の詳細フィードバックは PRO プラン限定です。"}
                  </p>
                  <a
                    href="/settings"
                    className="rounded-full bg-violet-500 px-4 py-2 text-[11px] text-white"
                  >
                    PRO プランにアップグレード
                  </a>
                </div>
              )}
            </div>
          </section>
        )}

        {/* AI ドラフト */}
        {aiDraft && (
          <section className="rounded-2xl border bg-indigo-50/80 p-4 text-[11px] shadow-sm">
            <h2 className="text-xs font-semibold text-indigo-800">
              AI 書き直しドラフト（PRO）
            </h2>

            <div
              className={
                locked
                  ? "rounded-xl bg-white p-3 opacity-70 blur-[1.5px]"
                  : "rounded-xl bg-white p-3"
              }
            >
              <pre className="whitespace-pre-wrap">{aiDraft}</pre>
            </div>

            {locked && (
              <div className="mt-2 text-center">
                <a
                  href="/settings"
                  className="rounded-full bg-violet-500 px-4 py-2 text-[11px] text-white"
                >
                  PROにアップグレードして全文を見る
                </a>
              </div>
            )}
          </section>
        )}
      </div>

      {/* 右側：ストーリーカード一覧 */}
      <aside className="w-80 shrink-0 space-y-4">
        <div className="rounded-2xl border bg-sky-50/80 p-4 text-[11px] shadow-sm">
          <p className="mb-1 font-semibold text-sky-800">
            ストーリーカードからひな型を作る
          </p>

          {/* AI Draft */}
          <button
            onClick={handleGenerateDraft}
            disabled={!selectedCardId || draftLoading}
            className={`w-full rounded-full px-3 py-1.5 text-[10px] font-semibold ${
              !selectedCardId || draftLoading
                ? "cursor-not-allowed bg-slate-200"
                : "bg-indigo-500 text-white"
            }`}
          >
            {draftLoading ? "生成中…" : "AIドラフト生成（PRO）"}
          </button>

          {/* カード一覧 */}
          {cardsLoading ? (
            <p>読み込み中…</p>
          ) : cardsError ? (
            <p className="text-rose-600">{cardsError}</p>
          ) : storyCards.length === 0 ? (
            <p>カードがありません。</p>
          ) : (
            <div className="mt-2 max-h-72 space-y-2 overflow-y-auto">
              {storyCards.map((card) => (
                <button
                  key={card.id}
                  onClick={() => handleApplyCardToEs(card)}
                  className={`w-full rounded-xl border bg-white/90 p-2 text-left text-[11px] shadow-sm hover:bg-sky-50 ${
                    selectedCardId === card.id
                      ? "border-sky-400 ring-1 ring-sky-200"
                      : "border-slate-100"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-500">
                      {topicLabelFromCard(card.topicType)}
                    </span>
                    <span className="text-[9px] text-slate-400">
                      {new Date(card.createdAt).toLocaleDateString("ja-JP")}
                    </span>
                  </div>
                  <p className="truncate font-semibold text-slate-800">
                    {card.title || "タイトル未設定"}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
};

/* ------------------------------
   Score Pill
--------------------------------*/
type ScorePillProps = {
  label: string;
  value: number;
};

const ScorePill: React.FC<ScorePillProps> = ({ label, value }) => {
  const color =
    value >= 8
      ? "bg-emerald-50 text-emerald-700 border-emerald-100"
      : value >= 6
      ? "bg-amber-50 text-amber-700 border-amber-100"
      : "bg-rose-50 text-rose-700 border-rose-100";

  return (
    <div
      className={`flex flex-col items-center justify-center rounded-xl border px-2 py-2 ${color}`}
    >
      <span className="text-[10px]">{label}</span>
      <span className="mt-1 text-sm font-semibold">{value}/10</span>
    </div>
  );
};
