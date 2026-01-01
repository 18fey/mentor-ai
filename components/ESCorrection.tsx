// src/components/ESCorrection.tsx
"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { MetaConfirmModal } from "@/components/MetaConfirmModal";

/* ------------------------------
   Types
--------------------------------*/
type QuestionType = "self_pr" | "gakuchika" | "why_company" | "why_industry" | "other";

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

// usage/consume 側
const USAGE_FEATURE_EVAL = "es_correction";
// draft も同じ枠でカウントするなら同一でOK
const USAGE_FEATURE_DRAFT = "es_correction";

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
  star: { situation: string; task: string; action: string; result: string };
  learnings: string;
  axes: string[];
  isSensitive: boolean;
  createdAt: string;
};

export const ESCorrection: React.FC = () => {
  const router = useRouter();

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

  // 🔒 ロック（サーバが locked を返す設計がある場合に備えて残す）
  const [locked, setLocked] = useState(false);
  const [lockMessage, setLockMessage] = useState<string | null>(null);

  const charCount = text.trim().length;

  // ストーリーカード
  const [storyCards, setStoryCards] = useState<StoryCard[]>([]);
  const [cardsLoading, setCardsLoading] = useState(false);
  const [cardsError, setCardsError] = useState<string | null>(null);

  // AIドラフト
  const [aiDraft, setAiDraft] = useState<string | null>(null);
  const [draftLoading, setDraftLoading] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  // ✅ UIゲート用：処理中
  const [isCheckingGate, setIsCheckingGate] = useState(false);

  // ✅ 共通METAモーダル
  const [metaModalOpen, setMetaModalOpen] = useState(false);
  const [metaBalance, setMetaBalance] = useState<number | null>(null);
  const [metaNeed, setMetaNeed] = useState<number>(1);
  const [metaMode, setMetaMode] = useState<"confirm" | "purchase">("confirm");
  const [metaTitle, setMetaTitle] = useState<string | undefined>(undefined);
  const [metaMessage, setMetaMessage] = useState<string | undefined>(undefined);
  const [pendingAction, setPendingAction] = useState<null | (() => Promise<void>)>(null);

  const closeMetaModal = () => {
    setMetaModalOpen(false);
    setMetaTitle(undefined);
    setMetaMessage(undefined);
    setPendingAction(null);
  };

  // ✅ 残高取得（meta_lots合計RPCの結果を返す /api/meta/balance を信じる）
  const fetchMyBalance = async (): Promise<number | null> => {
    try {
      const res = await fetch("/api/meta/balance", { method: "POST" });
      const j: any = await res.json().catch(() => ({}));
      if (!res.ok || j?.ok !== true) return null;
      return Number(j.balance ?? 0);
    } catch {
      return null;
    }
  };

  const openMetaModalFor = async (params: {
    requiredMeta: number;
    featureLabel: string;
    onProceed: () => Promise<void>;
  }) => {
    const { requiredMeta, onProceed } = params;

    const b = await fetchMyBalance();
    setMetaNeed(requiredMeta);
    setMetaBalance(typeof b === "number" ? b : metaBalance);

    const mode: "confirm" | "purchase" =
      typeof b === "number" && b < requiredMeta ? "purchase" : "confirm";

    setMetaMode(mode);
    setMetaTitle(undefined);
    setMetaMessage(undefined);

    setPendingAction(() => async () => {
      await onProceed();
      const bb = await fetchMyBalance();
      if (typeof bb === "number") setMetaBalance(bb);
    });

    setMetaModalOpen(true);
  };

  /* ------------------------------
   認証
  ------------------------------*/
  useEffect(() => {
    const run = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        setUserId(data.user?.id ?? null);

        const b = await fetchMyBalance();
        if (typeof b === "number") setMetaBalance(b);
      } finally {
        setAuthLoading(false);
      }
    };
    run();
  }, [supabase]);

  /* ------------------------------
   ストーリーカード取得
   ※ここは既存API仕様に合わせて userId を付けてる（可能ならサーバでセッション確定に寄せたい）
  ------------------------------*/
  useEffect(() => {
    if (!userId) return;

    const fetchCards = async () => {
      setCardsLoading(true);
      setCardsError(null);

      try {
        const res = await fetch(`/api/story-cards?userId=${encodeURIComponent(userId)}`);
        if (!res.ok) {
          setCardsError("ストーリーカードの取得に失敗しました。");
          return;
        }

        const data = await res.json().catch(() => ({}));
        const rows: any[] = Array.isArray(data.storyCards) ? data.storyCards : [];

        const mapped: StoryCard[] = rows.map((row: any) => {
          let axes: string[] = [];
          if (Array.isArray(row.axes)) axes = row.axes.filter((v: any) => typeof v === "string");
          else if (typeof row.axes === "string" && row.axes.length > 0) axes = row.axes.split(",").map((s: string) => s.trim());

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
  const mapTopicToQuestionType = (topic: StoryCard["topicType"]): QuestionType => {
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
   ES 評価（サーバが最終真実）
  ------------------------------*/
  const evaluateCore = async () => {
    if (!text.trim()) return;

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
        // ✅ userId は送らない（cookieセッションで確定）
        body: JSON.stringify({ text, company, qType, limit }),
      });

      const data: any = await res.json().catch(() => ({}));

      // ✅ サーバで meta 不足 (402) が来たら purchase
      if (!res.ok) {
        if (res.status === 402) {
          const requiredMeta = Number(data?.required ?? data?.requiredMeta ?? 1);
          const b =
            typeof data?.balance === "number" ? Number(data.balance) : await fetchMyBalance();

          setMetaNeed(requiredMeta);
          setMetaBalance(typeof b === "number" ? b : metaBalance);
          setMetaMode("purchase");
          setMetaTitle("METAが不足しています");
          setMetaMessage(`この実行には META が ${requiredMeta} 必要です。購入して続行してください。`);
          setMetaModalOpen(true);
          return;
        }

        setErrorMessage(data?.message ?? "AI添削に失敗しました。時間をおいて再度お試しください。");
        return;
      }

      if (!data?.feedback) {
        setErrorMessage("AI添削に失敗しました。時間をおいて再度お試しください。");
        return;
      }

      setScore(data.score ?? null);
      setFeedback(data.feedback ?? null);

      // locked を返す設計があるなら拾う（無ければ常に false のままでOK）
      setLocked(Boolean(data.locked));
      setLockMessage(typeof data.message === "string" ? data.message : null);

      // 実行後、残高を更新しておく（UX）
      const bb = await fetchMyBalance();
      if (typeof bb === "number") setMetaBalance(bb);
    } catch {
      setErrorMessage("ネットワークエラーが発生しました。");
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleEvaluate = async () => {
    if (!text.trim()) return;
    if (!userId) {
      setErrorMessage("ログイン情報を確認できませんでした。");
      return;
    }
    if (isCheckingGate || isEvaluating) return;

    setIsCheckingGate(true);
    setErrorMessage(null);

    try {
      // ✅ ① 無料枠チェック（usage）
      const usageRes = await fetch("/api/usage/consume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feature: USAGE_FEATURE_EVAL }),
      });
      const usageBody: any = await usageRes.json().catch(() => ({}));

      if (usageRes.ok) {
        await evaluateCore();
        return;
      }

      if (usageRes.status === 402 && usageBody?.error === "need_meta") {
        const requiredMeta = Number(usageBody.requiredMeta ?? 1);

        await openMetaModalFor({
          requiredMeta,
          featureLabel: "ES添削AI（構成・ロジックチェック）",
          onProceed: async () => {
            await evaluateCore();
          },
        });
        return;
      }

      console.error("usage/consume unexpected", usageRes.status, usageBody);
      setErrorMessage("実行条件の確認に失敗しました。時間をおいて再度お試しください。");
    } catch {
      setErrorMessage("ネットワークエラーが発生しました。");
    } finally {
      setIsCheckingGate(false);
    }
  };

  /* ------------------------------
   AIドラフト生成（/api/es/draft が featureGate で 402 を返す想定）
  ------------------------------*/
  const generateDraftCore = async () => {
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

      const data: any = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 402) {
          const requiredMeta = Number(data?.required ?? data?.requiredMeta ?? 1);
          const b =
            typeof data?.balance === "number" ? Number(data.balance) : await fetchMyBalance();

          setMetaNeed(requiredMeta);
          setMetaBalance(typeof b === "number" ? b : metaBalance);
          setMetaMode("purchase");
          setMetaTitle("METAが不足しています");
          setMetaMessage(`この実行には META が ${requiredMeta} 必要です。購入して続行してください。`);
          setMetaModalOpen(true);
          return;
        }

        setErrorMessage(data?.message ?? "ドラフト生成に失敗しました。");
        return;
      }

      if (!data?.draft) {
        setErrorMessage("ドラフト生成に失敗しました。");
        return;
      }

      setAiDraft(String(data.draft));

      // 実行後残高更新（UX）
      const bb = await fetchMyBalance();
      if (typeof bb === "number") setMetaBalance(bb);
    } catch {
      setErrorMessage("AIドラフト生成中にエラーが発生しました。");
    } finally {
      setDraftLoading(false);
    }
  };

  const handleGenerateDraft = async () => {
    if (!selectedCardId) {
      setErrorMessage("カードを1つ選択してください。");
      return;
    }
    if (isCheckingGate || draftLoading) return;

    setIsCheckingGate(true);
    setErrorMessage(null);

    try {
      // ✅ ① 無料枠チェック（usage）
      const usageRes = await fetch("/api/usage/consume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feature: USAGE_FEATURE_DRAFT }),
      });
      const usageBody: any = await usageRes.json().catch(() => ({}));

      if (usageRes.ok) {
        await generateDraftCore();
        return;
      }

      if (usageRes.status === 402 && usageBody?.error === "need_meta") {
        const requiredMeta = Number(usageBody.requiredMeta ?? 1);

        await openMetaModalFor({
          requiredMeta,
          featureLabel: "AIドラフト生成（ES）",
          onProceed: async () => {
            await generateDraftCore();
          },
        });
        return;
      }

      console.error("usage/consume unexpected", usageRes.status, usageBody);
      setErrorMessage("実行条件の確認に失敗しました。時間をおいて再度お試しください。");
    } catch {
      setErrorMessage("ネットワークエラーが発生しました。");
    } finally {
      setIsCheckingGate(false);
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
    <>
      <div className="flex h-full gap-6">
        {/* 左：入力 */}
        <div className="flex-1 space-y-6 overflow-y-auto pr-2">
          {/* Header */}
          <section className="rounded-2xl border bg-white/80 p-4 shadow-sm">
            <h1 className="mb-1 text-sm font-semibold">ES添削AI（構成・ロジックチェック）</h1>
            <p className="text-[11px] text-slate-600">ペーストしたESに対してAIが採点・改善ポイントを返します。</p>
          </section>

          {/* メタ情報 */}
          <section className="space-y-3 rounded-2xl border bg-white/80 p-4 shadow-sm">
            <div className="grid grid-cols-1 gap-3 text-xs md:grid-cols-3">
              <div>
                <label className="mb-1 block text-[11px] text-slate-500">企業名（任意）</label>
                <input
                  className="w-full rounded-full border bg-slate-50 px-3 py-1.5 text-xs"
                  placeholder="例：三井物産 / マッキンゼー"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] text-slate-500">設問の種類</label>
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
                <label className="mb-1 block text-[11px] text-slate-500">文字数目安</label>
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

            <div className="flex justify-end gap-2">
              <button
                onClick={handleEvaluate}
                disabled={!text.trim() || isEvaluating || isCheckingGate}
                className={`rounded-full px-5 py-2 text-xs font-semibold ${
                  !text.trim() || isEvaluating || isCheckingGate
                    ? "cursor-not-allowed bg-slate-200"
                    : "bg-violet-500 text-white hover:bg-violet-600"
                }`}
              >
                {isEvaluating ? "評価中…" : isCheckingGate ? "確認中…" : "AIに添削してもらう"}
              </button>
            </div>

            {errorMessage && <p className="mt-2 text-[11px] text-rose-600">{errorMessage}</p>}
          </section>

          {/* フィードバック */}
          {feedback && (
            <section className="space-y-4 rounded-2xl border bg-white/80 p-4 shadow-sm">
              <h2 className="text-xs font-semibold">フィードバック結果</h2>

              {score && (
                <div className="grid grid-cols-2 gap-2 text-[11px] md:grid-cols-5">
                  <ScorePill label="構成" value={score.structure} />
                  <ScorePill label="ロジック" value={score.logic} />
                  <ScorePill label="わかりやすさ" value={score.clarity} />
                  <ScorePill label="企業Fit" value={score.companyFit} />
                  <ScorePill label="文字数Fit" value={score.lengthFit} />
                </div>
              )}

              <div className="rounded-xl bg-slate-50 p-3 text-[11px] whitespace-pre-wrap">
                {feedback.summary}
              </div>

              <div>
                <p className="mb-1 text-[11px] font-semibold text-emerald-700">良いポイント</p>
                <ul className="list-disc pl-4 text-[11px]">
                  {feedback.strengths.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>

              {/* 🔒 ロック部分（サーバが locked を返す設計がある場合） */}
              <div className="relative">
                <div
                  className={
                    locked
                      ? "pointer-events-none space-y-4 rounded-xl border p-3 opacity-50 blur-[2px]"
                      : "space-y-4 rounded-xl border bg-slate-50/80 p-3"
                  }
                >
                  <div>
                    <p className="mb-1 text-[11px] font-semibold text-amber-700">改善ポイント</p>
                    <ul className="list-disc pl-4 text-[11px]">
                      {feedback.improvements.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <p className="mb-1 text-[11px] font-semibold">最終チェックリスト</p>
                    <ul className="list-disc pl-4 text-[11px]">
                      {feedback.checklist.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <p className="mb-1 text-[11px] font-semibold">構成サンプル</p>
                    <pre className="whitespace-pre-wrap rounded-xl bg-white p-3 text-[11px]">
                      {feedback.sampleStructure}
                    </pre>
                  </div>
                </div>

                {locked && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center rounded-xl bg-white/80 backdrop-blur-sm">
                    <p className="mb-2 px-3 text-center text-[11px] text-slate-600">
                      {lockMessage ?? "この先の詳細フィードバックは META 消費で解放できます。"}
                    </p>
                    <button
                      type="button"
                      onClick={() => router.push("/pricing")}
                      className="rounded-full bg-violet-500 px-4 py-2 text-[11px] text-white"
                    >
                      METAを購入する
                    </button>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* AI ドラフト */}
          {aiDraft && (
            <section className="rounded-2xl border bg-indigo-50/80 p-4 text-[11px] shadow-sm">
              <h2 className="text-xs font-semibold text-indigo-800">AI 書き直しドラフト</h2>

              <div
                className={
                  locked ? "rounded-xl bg-white p-3 opacity-70 blur-[1.5px]" : "rounded-xl bg-white p-3"
                }
              >
                <pre className="whitespace-pre-wrap">{aiDraft}</pre>
              </div>

              {locked && (
                <div className="mt-2 text-center">
                  <button
                    type="button"
                    onClick={() => router.push("/pricing")}
                    className="rounded-full bg-violet-500 px-4 py-2 text-[11px] text-white"
                  >
                    METAを購入して全文を見る
                  </button>
                </div>
              )}
            </section>
          )}
        </div>

        {/* 右：ストーリーカード */}
        <aside className="w-80 shrink-0 space-y-4">
          <div className="rounded-2xl border bg-sky-50/80 p-4 text-[11px] shadow-sm">
            <p className="mb-1 font-semibold text-sky-800">ストーリーカードからひな型を作る</p>

            <button
              onClick={handleGenerateDraft}
              disabled={!selectedCardId || draftLoading || isCheckingGate}
              className={`w-full rounded-full px-3 py-1.5 text-[10px] font-semibold ${
                !selectedCardId || draftLoading || isCheckingGate
                  ? "cursor-not-allowed bg-slate-200"
                  : "bg-indigo-500 text-white"
              }`}
            >
              {draftLoading ? "生成中…" : isCheckingGate ? "確認中…" : "AIドラフト生成"}
            </button>

            {cardsLoading ? (
              <p className="mt-2">読み込み中…</p>
            ) : cardsError ? (
              <p className="mt-2 text-rose-600">{cardsError}</p>
            ) : storyCards.length === 0 ? (
              <p className="mt-2">カードがありません。</p>
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

      {/* ✅ 共通METAモーダル */}
      <MetaConfirmModal
        open={metaModalOpen}
        onClose={closeMetaModal}
        featureLabel="ES添削AI"
        requiredMeta={metaNeed}
        balance={metaBalance}
        mode={metaMode}
        title={metaTitle}
        message={metaMessage}
        onConfirm={async () => {
          const fn = pendingAction;
          closeMetaModal();
          if (!fn) return;
          await fn();
        }}
        onPurchase={() => router.push("/pricing")}
      />
    </>
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
    <div className={`flex flex-col items-center justify-center rounded-xl border px-2 py-2 ${color}`}>
      <span className="text-[10px]">{label}</span>
      <span className="mt-1 text-sm font-semibold">{value}/10</span>
    </div>
  );
};
