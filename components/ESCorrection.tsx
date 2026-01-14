// src/components/ESCorrection.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
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

type DraftResponse = {
  ok: true;
  usedThisMonth?: number | null;
  freeLimit?: number | null;
  score: EsScore;
  strategy: string;
  keyEdits: string[];
  altOpening: string;
  altClosing: string;
  draft: string;
};

type EvalResponse = {
  ok: true;
  plan?: any;
  usedThisMonth?: number | null;
  freeLimit?: number | null;
  score: EsScore;
  feedback: EsFeedback;
};

type ApiErr = {
  ok?: false;
  error?: string;
  message?: string;
  requiredMeta?: number;
  required?: number;
  balance?: number | null;
};

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

const QUESTION_LABEL: Record<QuestionType, string> = {
  self_pr: "自己PR",
  gakuchika: "学生時代に力を入れたこと",
  why_company: "志望動機（企業）",
  why_industry: "志望動機（業界）",
  other: "その他",
};

/** ===== Job 방식（IndustryInsights と同じ） =====
 * feature は generation_jobs.feature_id と一致させる
 */
const FEATURE_EVAL = "es_correction";
const FEATURE_DRAFT = "es_draft";
const LS_KEY_EVAL = `last_job:${FEATURE_EVAL}`;
const LS_KEY_DRAFT = `last_job:${FEATURE_DRAFT}`;

function newIdempotencyKey() {
  // @ts-ignore
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

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
  const [aiDraft, setAiDraft] = useState<string | null>(null);

  const [isEvaluating, setIsEvaluating] = useState(false);
  const [draftLoading, setDraftLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 🔒（将来サーバが返す設計があるなら拾えるように残す）
  const [locked, setLocked] = useState(false);
  const [lockMessage, setLockMessage] = useState<string | null>(null);

  // ストーリーカード
  const [storyCards, setStoryCards] = useState<StoryCard[]>([]);
  const [cardsLoading, setCardsLoading] = useState(false);
  const [cardsError, setCardsError] = useState<string | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  const charCount = text.trim().length;

  // ✅ 共通METAモーダル（IndustryInsights と同じ挙動）
  const [metaModalOpen, setMetaModalOpen] = useState(false);
  const [metaBalance, setMetaBalance] = useState<number | null>(null);
  const [metaNeed, setMetaNeed] = useState<number>(1);
  const [metaMode, setMetaMode] = useState<"confirm" | "purchase">("confirm");
  const [metaTitle, setMetaTitle] = useState<string | undefined>(undefined);
  const [metaMessage, setMetaMessage] = useState<string | undefined>(undefined);
  const [pendingAction, setPendingAction] = useState<null | (() => Promise<void>)>(null);
  const [metaFeatureLabel, setMetaFeatureLabel] = useState<string>("スコアリング");

  // ✅ 復帰用：最後の key（デバッグ表示したければ使える）
  const [lastEvalKey, setLastEvalKey] = useState<string | null>(null);
  const [lastDraftKey, setLastDraftKey] = useState<string | null>(null);

  const closeMetaModal = () => {
    setMetaModalOpen(false);
    setMetaTitle(undefined);
    setMetaMessage(undefined);
    setPendingAction(null);
  };

  // ✅ 残高取得（UI用）
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

  /** ✅ status API で復帰（feature ごとに） */
  const fetchJobStatus = async (feature: string, key: string) => {
    const url = `/api/generation-jobs/status?feature=${encodeURIComponent(
      feature
    )}&key=${encodeURIComponent(key)}`;
    const res = await fetch(url, { method: "GET" });
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false as const, status: res.status, data };
    return { ok: true as const, data };
  };

  /** ✅ ポーリング */
  const pollJobUntilDone = async (
    feature: string,
    key: string,
    onSucceeded: (result: any) => void,
    onFailed?: (message?: string) => void,
    maxTries = 12,
    intervalMs = 900
  ) => {
    for (let i = 0; i < maxTries; i++) {
      const st = await fetchJobStatus(feature, key);
      if (st.ok && st.data?.ok && st.data?.job) {
        const job = st.data.job;
        const status = String(job.status ?? "");
        if (status === "succeeded" && job.result) {
          onSucceeded(job.result);
          return { done: true as const, status: "succeeded" as const };
        }
        if (status === "failed") {
          onFailed?.(job.error_message);
          return { done: true as const, status: "failed" as const };
        }
      }
      await sleep(intervalMs);
    }
    return { done: false as const };
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
   起動時：last_job があれば復帰（eval / draft 両方）
  ------------------------------*/
  useEffect(() => {
    // eval
    try {
      const raw = localStorage.getItem(LS_KEY_EVAL);
      if (raw) {
        const j = JSON.parse(raw);
        if (j?.key) {
          const key: string = j.key;
          setLastEvalKey(key);

          (async () => {
            const st = await fetchJobStatus(FEATURE_EVAL, key);
            if (st.ok && st.data?.ok && st.data?.job) {
              const job = st.data.job;
              const status = String(job.status ?? "");
              if (status === "succeeded" && job.result) {
                const r = job.result as EvalResponse;
                if (r?.score && r?.feedback) {
                  setScore(r.score);
                  setFeedback(r.feedback);
                }
                return;
              }
              if (status === "running" || status === "queued") {
                await pollJobUntilDone(
                  FEATURE_EVAL,
                  key,
                  (res) => {
                    const r = res as EvalResponse;
                    if (r?.score && r?.feedback) {
                      setScore(r.score);
                      setFeedback(r.feedback);
                    }
                  },
                  undefined,
                  8,
                  800
                );
              }
            }
          })();
        }
      }
    } catch {
      // ignore
    }

    // draft
    try {
      const raw = localStorage.getItem(LS_KEY_DRAFT);
      if (raw) {
        const j = JSON.parse(raw);
        if (j?.key) {
          const key: string = j.key;
          setLastDraftKey(key);

          (async () => {
            const st = await fetchJobStatus(FEATURE_DRAFT, key);
            if (st.ok && st.data?.ok && st.data?.job) {
              const job = st.data.job;
              const status = String(job.status ?? "");
              if (status === "succeeded" && job.result) {
                const r = job.result as DraftResponse;
                if (typeof r?.draft === "string") setAiDraft(r.draft);
                return;
              }
              if (status === "running" || status === "queued") {
                await pollJobUntilDone(
                  FEATURE_DRAFT,
                  key,
                  (res) => {
                    const r = res as DraftResponse;
                    if (typeof r?.draft === "string") setAiDraft(r.draft);
                  },
                  undefined,
                  8,
                  800
                );
              }
            }
          })();
        }
      }
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ------------------------------
   ストーリーカード取得（既存仕様のまま）
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
          else if (typeof row.axes === "string" && row.axes.length > 0)
            axes = row.axes.split(",").map((s: string) => s.trim());

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

    // カード差し替え時は復帰キーを消しておく（混ざると事故りやすい）
    try {
      localStorage.removeItem(LS_KEY_DRAFT);
    } catch {}
    setLastDraftKey(null);
  };

  /* ------------------------------
   ES 評価（IndustryInsights と同じ：idempotency + 402 confirm）
  ------------------------------*/
  const evaluateCore = async (opts?: { key?: string; metaConfirm?: boolean }) => {
    if (isEvaluating) return;

    setIsEvaluating(true);
    setErrorMessage(null);
    setScore(null);
    setFeedback(null);
    setLocked(false);
    setLockMessage(null);

    const key = opts?.key ?? newIdempotencyKey();
    setLastEvalKey(key);

    try {
      localStorage.setItem(LS_KEY_EVAL, JSON.stringify({ key, createdAt: Date.now() }));
    } catch {
      // ignore
    }

    try {
      const res = await fetch("/api/es/eval", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Idempotency-Key": key,
          ...(opts?.metaConfirm ? { "X-Meta-Confirm": "1" } : {}),
        },
        body: JSON.stringify({ text, company, qType, limit }),
      });

      const data: any = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 402 && (data?.error === "need_meta" || data?.requiredMeta || data?.required)) {
          setMetaFeatureLabel("スコアリング（構成・ロジックチェック）");

          const requiredMeta = Number(data?.requiredMeta ?? data?.required ?? 1);
          const b =
            typeof data?.balance === "number" ? Number(data.balance) : await fetchMyBalance();

          setMetaNeed(requiredMeta);
          setMetaBalance(typeof b === "number" ? b : null);

          const mode: "confirm" | "purchase" =
            typeof b === "number" && b < requiredMeta ? "purchase" : "confirm";

          setMetaMode(mode);
          setMetaTitle("METAが必要です");
          setMetaMessage(`この実行には META が ${requiredMeta} 必要です。続行しますか？`);

          if (mode === "confirm") {
            setPendingAction(() => async () => {
              await evaluateCore({ key, metaConfirm: true });
              const bb = await fetchMyBalance();
              if (typeof bb === "number") setMetaBalance(bb);
            });
          } else {
            setPendingAction(null);
          }

          setMetaModalOpen(true);
          return;
        }

        setErrorMessage(data?.message ?? "AI添削に失敗しました。時間をおいて再度お試しください。");

        // ✅ 途中で成功してる可能性があるので救済
        await pollJobUntilDone(
          FEATURE_EVAL,
          key,
          (res2) => {
            const r = res2 as EvalResponse;
            if (r?.score && r?.feedback) {
              setScore(r.score);
              setFeedback(r.feedback);
            }
          },
          (msg) => setErrorMessage(msg ?? "ジョブが失敗しました。")
        );

        return;
      }

      if (!data?.feedback) {
        setErrorMessage("AI添削に失敗しました。時間をおいて再度お試しください。");
        return;
      }

      const okData = data as EvalResponse;
      setScore(okData.score ?? null);
      setFeedback(okData.feedback ?? null);

      // locked（将来）
      setLocked(Boolean((data as any).locked));
      setLockMessage(typeof (data as any).message === "string" ? (data as any).message : null);

      const bb = await fetchMyBalance();
      if (typeof bb === "number") setMetaBalance(bb);
    } catch {
      setErrorMessage("ネットワークエラーが発生しました。");

      // ✅ ネットワークで落ちた場合も救済
      await pollJobUntilDone(
        FEATURE_EVAL,
        key,
        (res2) => {
          const r = res2 as EvalResponse;
          if (r?.score && r?.feedback) {
            setScore(r.score);
            setFeedback(r.feedback);
          }
        },
        undefined,
        8,
        900
      );
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleEvaluate = async () => {
    if (!userId) {
      setErrorMessage("ログイン情報を確認できませんでした。");
      return;
    }
    if (!text.trim()) return;

    await evaluateCore();
  };

  /* ------------------------------
   AIドラフト生成（IndustryInsights と同じ）
  ------------------------------*/
  const generateDraftCore = async (opts?: { key?: string; metaConfirm?: boolean }) => {
    if (draftLoading) return;

    if (!selectedCardId && text.trim().length < 30) {
      setErrorMessage("カードを選ぶか、本文を30文字以上入力してください。");
      return;
    }

    setDraftLoading(true);
    setErrorMessage(null);
    setAiDraft(null);

    const key = opts?.key ?? newIdempotencyKey();
    setLastDraftKey(key);

    try {
      localStorage.setItem(LS_KEY_DRAFT, JSON.stringify({ key, createdAt: Date.now() }));
    } catch {
      // ignore
    }

    try {
      const res = await fetch("/api/es/draft", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Idempotency-Key": key,
          ...(opts?.metaConfirm ? { "X-Meta-Confirm": "1" } : {}),
        },
        body: JSON.stringify({
          storyCardId: selectedCardId ?? undefined,
          text: selectedCardId ? undefined : text,
          company,
          qType,
          limit,
        }),
      });

      const data: any = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 402 && (data?.error === "need_meta" || data?.requiredMeta || data?.required)) {
          setMetaFeatureLabel("AIドラフト生成（ES）");

          const requiredMeta = Number(data?.requiredMeta ?? data?.required ?? 1);
          const b =
            typeof data?.balance === "number" ? Number(data.balance) : await fetchMyBalance();

          setMetaNeed(requiredMeta);
          setMetaBalance(typeof b === "number" ? b : null);

          const mode: "confirm" | "purchase" =
            typeof b === "number" && b < requiredMeta ? "purchase" : "confirm";

          setMetaMode(mode);
          setMetaTitle("METAが必要です");
          setMetaMessage(`この実行には META が ${requiredMeta} 必要です。続行しますか？`);

          if (mode === "confirm") {
            setPendingAction(() => async () => {
              await generateDraftCore({ key, metaConfirm: true });
              const bb = await fetchMyBalance();
              if (typeof bb === "number") setMetaBalance(bb);
            });
          } else {
            setPendingAction(null);
          }

          setMetaModalOpen(true);
          return;
        }

        setErrorMessage(data?.message ?? "ドラフト生成に失敗しました。");

        // ✅ 救済
        await pollJobUntilDone(
          FEATURE_DRAFT,
          key,
          (res2) => {
            const r = res2 as DraftResponse;
            if (typeof r?.draft === "string") setAiDraft(r.draft);
          },
          (msg) => setErrorMessage(msg ?? "ジョブが失敗しました。")
        );

        return;
      }

      if (!data?.draft) {
        setErrorMessage("ドラフト生成に失敗しました。");
        return;
      }

      const okData = data as DraftResponse;
      setAiDraft(String(okData.draft));

      const bb = await fetchMyBalance();
      if (typeof bb === "number") setMetaBalance(bb);
    } catch {
      setErrorMessage("AIドラフト生成中にネットワークエラーが発生しました。");

      // ✅ 救済
      await pollJobUntilDone(
        FEATURE_DRAFT,
        key,
        (res2) => {
          const r = res2 as DraftResponse;
          if (typeof r?.draft === "string") setAiDraft(r.draft);
        },
        undefined,
        8,
        900
      );
    } finally {
      setDraftLoading(false);
    }
  };

  const handleGenerateDraft = async () => {
    if (!userId) {
      setErrorMessage("ログイン情報を確認できませんでした。");
      return;
    }
    await generateDraftCore();
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

  // ✅ ドラフトボタンの押せる条件（1箇所）
  const canGenerateDraft = selectedCardId !== null || text.trim().length >= 30;

  return (
    <>
      <div className="flex h-full gap-6">
        {/* 左：入力 */}
        <div className="flex-1 space-y-6 overflow-y-auto pr-2">
          {/* Header */}
          <section className="rounded-2xl border bg-white/80 p-4 shadow-sm">
            <h1 className="mb-1 text-sm font-semibold">ES添削AI（構成・ロジックチェック）</h1>
            <p className="text-[11px] text-slate-600">
              ペーストしたESに対してAIが採点・改善ポイントを返します。ドラフト生成もできます。
            </p>
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
              {/* AIドラフト生成 */}
              <button
                onClick={handleGenerateDraft}
                disabled={!canGenerateDraft || draftLoading}
                className={`rounded-full px-5 py-2 text-xs font-semibold ${
                  !canGenerateDraft || draftLoading
                    ? "cursor-not-allowed bg-slate-200"
                    : "bg-indigo-500 text-white hover:bg-indigo-600"
                }`}
              >
                {draftLoading ? "生成中…" : "ESドラフト生成"}
              </button>

              {/* ES評価 */}
              <button
                onClick={handleEvaluate}
                disabled={!text.trim() || isEvaluating}
                className={`rounded-full px-5 py-2 text-xs font-semibold ${
                  !text.trim() || isEvaluating
                    ? "cursor-not-allowed bg-slate-200"
                    : "bg-violet-500 text-white hover:bg-violet-600"
                }`}
              >
                {isEvaluating ? "評価中…" : "スコアリング"}
              </button>
            </div>

            {errorMessage && <p className="mt-2 text-[11px] text-rose-600">{errorMessage}</p>}

            {/* デバッグ表示（本番は消してOK） */}
            {(lastEvalKey || lastDraftKey) && (
              <div className="mt-2 text-[10px] text-slate-300">
                {lastDraftKey && <div>draft key: {lastDraftKey.slice(0, 8)}…</div>}
                {lastEvalKey && <div>eval key: {lastEvalKey.slice(0, 8)}…</div>}
              </div>
            )}
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

              {/* 🔒 ロック（将来サーバが locked を返す設計がある場合） */}
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

              <div className="rounded-xl bg-white p-3">
                <pre className="whitespace-pre-wrap">{aiDraft}</pre>
              </div>
            </section>
          )}
        </div>

        {/* 右：ストーリーカード */}
        <aside className="w-80 shrink-0 space-y-4">
          <div className="rounded-2xl border bg-sky-50/80 p-4 text-[11px] shadow-sm">
            <p className="mb-1 font-semibold text-sky-800">ストーリーカードからひな型を作る</p>

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

      {/* ✅ 共通METAモーダル（confirm → 同じ key で X-Meta-Confirm:1 再実行） */}
      <MetaConfirmModal
        open={metaModalOpen}
        onClose={closeMetaModal}
        featureLabel={metaFeatureLabel}
        requiredMeta={metaNeed}
        balance={metaBalance}
        mode={metaMode}
        title={metaTitle}
        message={metaMessage}
        onConfirm={
          metaMode === "confirm"
            ? async () => {
                const fn = pendingAction;
                closeMetaModal();
                if (!fn) return;
                try {
                  await fn();
                } catch (e) {
                  console.error(e);
                  setErrorMessage("実行に失敗しました。時間をおいて再度お試しください。");
                }
              }
            : undefined
        }
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
