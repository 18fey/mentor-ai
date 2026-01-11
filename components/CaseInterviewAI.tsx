// src/components/CaseInterviewAI.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { MetaConfirmModal } from "@/components/MetaConfirmModal";

/* ============================
   型定義
============================ */
type CaseDomain = "consulting" | "general" | "trading" | "ib";
type CasePattern = "market_sizing" | "profitability" | "entry" | "new_business" | "operation";

type CaseQuestion = {
  id: string;
  domain: CaseDomain;
  pattern: CasePattern;
  title: string;
  client: string;
  prompt: string;
  hint: string;
  kpiExamples: string;
};

type CaseScore = {
  structure: number;
  hypothesis: number;
  insight: number;
  practicality: number;
  communication: number;
};

type CaseFeedback = {
  summary: string;
  goodPoints: string;
  improvePoints: string;
  nextTraining: string;
};

type Answers = {
  goal: string;
  kpi: string;
  framework: string;
  hypothesis: string;
  deepDivePlan: string;
  analysis: string;
  solutions: string;
  risks: string;
  wrapUp: string;
};

// ✅ 旧planは表示上の互換だけ残す（将来削除OK）
type Plan = "free" | "pro" | "elite";

// ✅ 新：case/generate の返却想定（meta対応版）
type GenerateOk = {
  ok: true;
  mode?: "unlimited" | "free" | "need_meta";
  requiredMeta?: number;
  case: CaseQuestion;
};

type EvalNormalized = {
  score: CaseScore;
  feedback: CaseFeedback;
  totalScore?: number;
  logId?: number | string | null;
};

type ApiErr = {
  ok?: false;
  error?: string;
  message?: string;
  requiredMeta?: number;
  required?: number;
  balance?: number;
};

type FeatureId = "case_interview";

// generation_jobs/status の返却想定
type JobStatus = "queued" | "running" | "succeeded" | "failed" | string;

type GenerationJob = {
  id: string;
  status: JobStatus;
  result: any | null;
  error_code: string | null;
  error_message: string | null;
  updated_at: string | null;
  created_at: string | null;
};

const FEATURE_LABEL = "ケース面接AI";
const FEATURE_ID: FeatureId = "case_interview";

// localStorage keys
const LS_KEY_EVAL = "genjob:case_eval:key";

// ✅ Case session persistence（次のケース生成まで保持）
const LS_KEY_CASE_SESSION_PREFIX = "case_session:v1";

type CaseSession = {
  v: 1;
  domain: CaseDomain;
  pattern: CasePattern;
  currentCase: CaseQuestion | null;
  answers: Answers;
  eval: {
    score: CaseScore;
    feedback: CaseFeedback | null;
    totalScore: number | null;
    lastLogId: number | string | null;
  };
  updatedAt: string; // ISO
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function makeIdempotencyKey(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export const CaseInterviewAI: React.FC = () => {
  const router = useRouter();

  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  // auth
  const [userId, setUserId] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // ケース選択
  const [domain, setDomain] = useState<CaseDomain>("consulting");
  const [pattern, setPattern] = useState<CasePattern>("market_sizing");
  const [currentCase, setCurrentCase] = useState<CaseQuestion | null>(null);

  // 回答（ステップ別）
  const [goal, setGoal] = useState("");
  const [kpi, setKpi] = useState("");
  const [framework, setFramework] = useState("");
  const [hypothesis, setHypothesis] = useState("");
  const [deepDivePlan, setDeepDivePlan] = useState("");
  const [analysis, setAnalysis] = useState("");
  const [solutions, setSolutions] = useState("");
  const [risks, setRisks] = useState("");
  const [wrapUp, setWrapUp] = useState("");

  // 状態
  // ✅ plan/remaining は互換のためだけ残す（今は使わない想定）
  const [plan, setPlan] = useState<Plan>("free");
  const [remaining, setRemaining] = useState<number | null>(null);
  const [uiError, setUiError] = useState<string | null>(null);

  // 評価
  const [score, setScore] = useState<CaseScore>({
    structure: 0,
    hypothesis: 0,
    insight: 0,
    practicality: 0,
    communication: 0,
  });
  const [feedback, setFeedback] = useState<CaseFeedback | null>(null);
  const [totalScore, setTotalScore] = useState<number | null>(null);
  const [lastLogId, setLastLogId] = useState<number | string | null>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);

  // ✅ 実行中ジョブkey（復帰用）
  const [activeEvalKey, setActiveEvalKey] = useState<string | null>(null);

  // ✅ ポーリング停止
  const pollingAbortRef = useRef<{ eval: boolean }>({ eval: false });

  // ✅ MetaConfirmModal
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

  // ✅ Case session persistence helpers
  const makeSessionKey = (uid: string) => `${LS_KEY_CASE_SESSION_PREFIX}:${uid}`;

  const saveSession = (s: CaseSession) => {
    try {
      if (!userId) return;
      localStorage.setItem(makeSessionKey(userId), JSON.stringify(s));
    } catch {}
  };

  const loadSession = (): CaseSession | null => {
    try {
      if (!userId) return null;
      const raw = localStorage.getItem(makeSessionKey(userId));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed?.v !== 1) return null;
      return parsed as CaseSession;
    } catch {
      return null;
    }
  };

  const clearSession = () => {
    try {
      if (!userId) return;
      localStorage.removeItem(makeSessionKey(userId));
    } catch {}
  };

  // localStorage helpers（job復帰用）
  const setLocalKey = (key: string) => {
    try {
      localStorage.setItem(LS_KEY_EVAL, key);
    } catch {}
  };
  const getLocalKey = () => {
    try {
      return localStorage.getItem(LS_KEY_EVAL);
    } catch {
      return null;
    }
  };
  const clearLocalKey = () => {
    try {
      localStorage.removeItem(LS_KEY_EVAL);
    } catch {}
  };

  // ✅ 残高取得（GETに統一）
  const fetchMyBalance = async (): Promise<number | null> => {
    try {
      const res = await fetch("/api/meta/balance", { method: "GET" });
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
    setMetaTitle("METAが必要です");
    setMetaMessage(`この実行には META が ${requiredMeta} 必要です。続行しますか？`);

    setPendingAction(() => async () => {
      await onProceed();
      const bb = await fetchMyBalance();
      if (typeof bb === "number") setMetaBalance(bb);
    });

    setMetaModalOpen(true);
  };

  /* -------------------------
     認証
  ------------------------- */
  useEffect(() => {
    (async () => {
      try {
        setAuthError(null);
        const { data, error } = await supabase.auth.getUser();
        if (error || !data?.user?.id) {
          setUserId(null);
          setAuthError("ログイン情報が取得できませんでした。いったんログインし直してください。");
          return;
        }
        setUserId(data.user.id);

        const b = await fetchMyBalance();
        if (typeof b === "number") setMetaBalance(b);
      } finally {
        setAuthLoading(false);
      }
    })();
  }, [supabase]);

  /* -------------------------
     ✅ セッション復元（ケース/回答/評価）
     - 次のケース生成を押すまで保持
  ------------------------- */
  useEffect(() => {
    if (authLoading) return;
    if (!userId) return;

    const s = loadSession();
    if (!s) return;

    setDomain(s.domain);
    setPattern(s.pattern);
    setCurrentCase(s.currentCase);

    setGoal(s.answers.goal);
    setKpi(s.answers.kpi);
    setFramework(s.answers.framework);
    setHypothesis(s.answers.hypothesis);
    setDeepDivePlan(s.answers.deepDivePlan);
    setAnalysis(s.answers.analysis);
    setSolutions(s.answers.solutions);
    setRisks(s.answers.risks);
    setWrapUp(s.answers.wrapUp);

    setScore(s.eval.score);
    setFeedback(s.eval.feedback);
    setTotalScore(s.eval.totalScore);
    setLastLogId(s.eval.lastLogId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, userId]);

  /* -------------------------
     ✅ セッション自動保存（入力中/評価後も保持）
  ------------------------- */
  const saveTimerRef = useRef<any>(null);

  useEffect(() => {
    if (!userId) return;
    if (!currentCase) return; // 未開始は保存しない

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    saveTimerRef.current = setTimeout(() => {
      const session: CaseSession = {
        v: 1,
        domain,
        pattern,
        currentCase,
        answers: {
          goal,
          kpi,
          framework,
          hypothesis,
          deepDivePlan,
          analysis,
          solutions,
          risks,
          wrapUp,
        },
        eval: {
          score,
          feedback,
          totalScore,
          lastLogId,
        },
        updatedAt: new Date().toISOString(),
      };

      saveSession(session);
    }, 400);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [
    userId,
    domain,
    pattern,
    currentCase,
    goal,
    kpi,
    framework,
    hypothesis,
    deepDivePlan,
    analysis,
    solutions,
    risks,
    wrapUp,
    score,
    feedback,
    totalScore,
    lastLogId,
  ]);

  /* -------------------------
     共通：generation_jobs/status
  ------------------------- */
  const fetchJobStatus = async (feature: FeatureId, key: string): Promise<GenerationJob | null> => {
    try {
      const res = await fetch(
        `/api/generation-jobs/status?feature=${encodeURIComponent(feature)}&key=${encodeURIComponent(
          key
        )}`,
        { method: "GET" }
      );
      const j: any = await res.json().catch(() => ({}));
      if (!res.ok || j?.ok !== true) return null;
      return (j.job ?? null) as GenerationJob | null;
    } catch {
      return null;
    }
  };

  const pollUntilDone = async (params: {
    feature: FeatureId;
    key: string;
    onSucceeded: (result: any) => Promise<void> | void;
    onFailed: (job: GenerationJob) => Promise<void> | void;
    maxTries?: number;
  }) => {
    const { feature, key, onSucceeded, onFailed, maxTries = 120 } = params;

    for (let i = 0; i < maxTries; i++) {
      if (pollingAbortRef.current.eval) return;

      const job = await fetchJobStatus(feature, key);
      if (job) {
        if (job.status === "succeeded") {
          await onSucceeded(job.result);
          return;
        }
        if (job.status === "failed") {
          await onFailed(job);
          return;
        }
      }

      await sleep(900);
    }

    setUiError("処理がタイムアウトしました。もう一度お試しください。");
  };

  /* -------------------------
     フォームリセット
  ------------------------- */
  const resetAnswers = () => {
    setGoal("");
    setKpi("");
    setFramework("");
    setHypothesis("");
    setDeepDivePlan("");
    setAnalysis("");
    setSolutions("");
    setRisks("");
    setWrapUp("");
    setScore({
      structure: 0,
      hypothesis: 0,
      insight: 0,
      practicality: 0,
      communication: 0,
    });
    setFeedback(null);
    setTotalScore(null);
    setLastLogId(null);
  };

  /* -------------------------
     ケース生成（API） ✅ meta confirm対応
     - 1st: metaConfirm=false
     - 402 need_meta → modal
     - confirm後: metaConfirm=true
     - 残高不足ならpricingへ
  ------------------------- */
  const startGenerate = async (metaConfirm: boolean) => {
    const res = await fetch("/api/case/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(metaConfirm ? { "X-Meta-Confirm": "1" } : {}),
      },
      body: JSON.stringify({ domain, pattern }),
    });

    const json = (await res.json().catch(() => ({}))) as GenerateOk | ApiErr;

    // ✅ need_meta → モーダル
    if (!res.ok && res.status === 402) {
      const requiredMeta = Number((json as any)?.requiredMeta ?? (json as any)?.required ?? 1);

      await openMetaModalFor({
        requiredMeta,
        featureLabel: FEATURE_LABEL,
        onProceed: async () => {
          // confirm押下時に残高が足りないなら purchaseへ
          const b = await fetchMyBalance();
          if (typeof b === "number" && b < requiredMeta) {
            closeMetaModal();
            router.push("/pricing");
            return;
          }

          setIsGenerating(true);
          try {
            await startGenerate(true);
          } finally {
            setIsGenerating(false);
          }
        },
      });

      return;
    }

    if (!res.ok) {
      setUiError((json as ApiErr)?.message ?? "ケース生成に失敗しました。");
      return;
    }

    const data = json as GenerateOk;

    // ✅ 次の問題を生成したタイミングで、前のセッションは破棄（要件通り）
    clearSession();

    // ✅ 互換表示（plan/remainingは今後消してOK）
    // APIがmodeを返す場合、表示はfreeのままでOK（Meta課金が本体）
    if (data?.mode === "unlimited") setPlan("pro");
    else setPlan("free");
    setRemaining(null);

    setCurrentCase(data.case);
    resetAnswers();

    // ✅ 新しいケースを出したら、前の評価job復帰キーは消しておく（混乱防止）
    clearLocalKey();
    setActiveEvalKey(null);

    const bb = await fetchMyBalance();
    if (typeof bb === "number") setMetaBalance(bb);
  };

  const handleGenerateCase = async () => {
    setUiError(null);
    if (!userId) {
      setUiError("ログインが必要です。");
      return;
    }

    try {
      setIsGenerating(true);
      await startGenerate(false);
    } catch (e) {
      console.error(e);
      setUiError("通信エラーが発生しました。時間をおいて再度お試しください。");
    } finally {
      setIsGenerating(false);
    }
  };

  /* -------------------------
     ✅ 結果反映（復帰にも使う）
  ------------------------- */
  const applyEvalResult = async (result: any) => {
    if (!result) {
      setUiError("結果の取得に失敗しました。");
      return;
    }

    const normalized: EvalNormalized | null =
      result?.normalized ?? result?.result?.normalized ?? result?.result ?? result ?? null;

    if (!normalized?.feedback) {
      setUiError("AI評価の結果が取得できませんでした。");
      return;
    }

    setScore(normalized.score);
    setFeedback(normalized.feedback);
    setTotalScore(typeof normalized.totalScore === "number" ? normalized.totalScore : null);
    setLastLogId(normalized.logId ?? null);
  };

  /* -------------------------
     ✅ Job方式：評価API実行（meta confirm対応）
     - 1st: metaConfirm=false
     - 402 need_meta → modal
     - confirm後: metaConfirm=true + 同じkey
  ------------------------- */
  const startEvalWithKey = async (key: string, metaConfirm: boolean, payload: any) => {
    pollingAbortRef.current.eval = false;

    const res = await fetch("/api/eval/case", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Idempotency-Key": key,
        ...(metaConfirm ? { "X-Meta-Confirm": "1" } : {}),
      },
      body: JSON.stringify(payload),
    });

    const data: any = await res.json().catch(() => ({}));

    // ✅ need_meta（confirm モーダル）
    if (!res.ok && res.status === 402) {
      const requiredMeta = Number(data?.requiredMeta ?? data?.required ?? 1);

      await openMetaModalFor({
        requiredMeta,
        featureLabel: FEATURE_LABEL,
        onProceed: async () => {
          // ✅ confirm押下時に残高が足りないなら purchaseへ
          const b = await fetchMyBalance();
          if (typeof b === "number" && b < requiredMeta) {
            closeMetaModal();
            router.push("/pricing");
            return;
          }

          setIsEvaluating(true);
          try {
            await startEvalWithKey(key, true, payload);
          } finally {
            setIsEvaluating(false);
          }
        },
      });

      return;
    }

    // ✅ その他エラー
    if (!res.ok) {
      setUiError(data?.message ?? "評価に失敗しました。時間をおいて再度お試しください。");
      clearLocalKey();
      setActiveEvalKey(null);
      return;
    }

    // ✅ 200 OK: status側で確定
    await pollUntilDone({
      feature: FEATURE_ID,
      key,
      onSucceeded: async (jobResult) => {
        await applyEvalResult(jobResult);

        clearLocalKey();
        setActiveEvalKey(null);

        const bb = await fetchMyBalance();
        if (typeof bb === "number") setMetaBalance(bb);
      },
      onFailed: async (job) => {
        setUiError(job.error_message ?? "処理に失敗しました。");
        clearLocalKey();
        setActiveEvalKey(null);
      },
    });
  };

  const runEvalJob = async (payload: any) => {
    setUiError(null);

    const existing = activeEvalKey ?? getLocalKey();
    const key = existing || makeIdempotencyKey("case_eval");

    setActiveEvalKey(key);
    setLocalKey(key);

    setIsEvaluating(true);
    try {
      await startEvalWithKey(key, false, payload);
    } catch (e) {
      console.error(e);
      setUiError("ネットワークエラーが発生しました。");
      clearLocalKey();
      setActiveEvalKey(null);
    } finally {
      setIsEvaluating(false);
    }
  };

  /* -------------------------
     ✅ リロード復帰（localStorage → status → 反映 or ポーリング再開）
  ------------------------- */
  useEffect(() => {
    if (authLoading) return;
    if (!userId) return;

    const resume = async () => {
      const ek = getLocalKey();
      if (!ek) return;

      setActiveEvalKey(ek);
      setIsEvaluating(true);

      try {
        const job = await fetchJobStatus(FEATURE_ID, ek);
        if (!job) {
          clearLocalKey();
          setActiveEvalKey(null);
          return;
        }

        if (job.status === "succeeded") {
          await applyEvalResult(job.result);
          clearLocalKey();
          setActiveEvalKey(null);

          const bb = await fetchMyBalance();
          if (typeof bb === "number") setMetaBalance(bb);
          return;
        }

        if (job.status === "failed") {
          setUiError(job.error_message ?? "処理に失敗しました。");
          clearLocalKey();
          setActiveEvalKey(null);
          return;
        }

        await pollUntilDone({
          feature: FEATURE_ID,
          key: ek,
          onSucceeded: async (result) => {
            await applyEvalResult(result);
            clearLocalKey();
            setActiveEvalKey(null);

            const bb = await fetchMyBalance();
            if (typeof bb === "number") setMetaBalance(bb);
          },
          onFailed: async (j) => {
            setUiError(j.error_message ?? "処理に失敗しました。");
            clearLocalKey();
            setActiveEvalKey(null);
          },
        });
      } finally {
        setIsEvaluating(false);
      }
    };

    resume();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, userId]);

  /* -------------------------
     AI評価（クリック）
  ------------------------- */
  const handleEvaluate = async () => {
    setUiError(null);
    if (!currentCase) return;
    if (!userId) return setUiError("ログインが必要です。");
    if (isEvaluating) return;

    const totalLen =
      goal.length +
      kpi.length +
      framework.length +
      hypothesis.length +
      deepDivePlan.length +
      analysis.length +
      solutions.length +
      risks.length +
      wrapUp.length;

    if (totalLen < 80) {
      return setUiError("もう少し書いてから評価してみて！目安：合計80文字以上。");
    }

    setFeedback(null);
    setTotalScore(null);
    setLastLogId(null);
    setScore({
      structure: 0,
      hypothesis: 0,
      insight: 0,
      practicality: 0,
      communication: 0,
    });

    await runEvalJob({
      case: currentCase,
      answers: {
        goal,
        kpi,
        framework,
        hypothesis,
        deepDivePlan,
        analysis,
        solutions,
        risks,
        wrapUp,
      },
    });
  };

  /* -------------------------
     unmount cleanup
  ------------------------- */
  useEffect(() => {
    return () => {
      pollingAbortRef.current.eval = true;
    };
  }, []);

  /* -------------------------
     レイアウト
  ------------------------- */
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
        {/* 左：ケース生成 + 回答入力 */}
        <div className="flex-1 space-y-6 overflow-y-auto pr-2">
          {(authError || uiError) && (
            <div className="rounded-2xl border border-rose-100 bg-rose-50 p-3 text-xs text-rose-700">
              {authError ?? uiError}
            </div>
          )}

          {/* ケースガチャ */}
          <section className="rounded-2xl border border-sky-100 bg-sky-50/70 p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h1 className="text-sm font-semibold text-sky-900">Case Interview Trainer</h1>
                <p className="mt-1 text-[11px] text-sky-700">
                  業界とケース種別を選んで「新しいケースを出す」を押すと、ケース問題が生成されます。
                </p>

                {/* 互換表示（不要なら消してOK） */}
                <p className="mt-1 text-[11px] text-sky-700">
                  Plan: <span className="font-semibold">{plan}</span>
                  {typeof remaining === "number" && (
                    <>
                      {" "}
                      / 今月残り: <span className="font-semibold">{remaining}</span>
                    </>
                  )}
                </p>

                <p className="mt-1 text-[11px] text-sky-700">
                  META:{" "}
                  <span className="font-semibold">
                    {typeof metaBalance === "number" ? metaBalance : "-"}
                  </span>
                </p>
              </div>

              <button
                type="button"
                onClick={handleGenerateCase}
                disabled={isGenerating}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold text-white shadow-sm ${
                  isGenerating ? "cursor-not-allowed bg-slate-300" : "bg-sky-500 hover:bg-sky-600"
                }`}
              >
                {isGenerating ? "生成中…" : "🎲 新しいケースを出す"}
              </button>
            </div>

            <div className="mb-2 grid grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] text-slate-600">業界モード</label>
                <select
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white/80 px-2 py-1.5 text-xs outline-none"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value as CaseDomain)}
                >
                  <option value="consulting">コンサル</option>
                  <option value="general">日系総合（商社・メーカー等）</option>
                  <option value="trading">総合商社ケース</option>
                  <option value="ib">外銀IB / M&amp;A</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] text-slate-600">ケースの種類</label>
                <select
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white/80 px-2 py-1.5 text-xs outline-none"
                  value={pattern}
                  onChange={(e) => setPattern(e.target.value as CasePattern)}
                >
                  <option value="market_sizing">市場規模</option>
                  <option value="profitability">利益改善</option>
                  <option value="entry">市場参入</option>
                  <option value="new_business">新規事業 / M&amp;A</option>
                  <option value="operation">オペレーション改善</option>
                </select>
              </div>

              <div className="flex items-end">
                <p className="w-full text-[11px] text-slate-500">
                  {currentCase ? (
                    <>
                      現在のケースID: <span className="font-mono">{currentCase.id}</span>
                    </>
                  ) : (
                    "まずは「新しいケースを出す」でスタート。"
                  )}
                </p>
              </div>
            </div>
          </section>

          {/* ケース本文 */}
          <section className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
            <h2 className="mb-2 text-sm font-semibold text-slate-800">① ケース本文</h2>
            {currentCase ? (
              <div className="space-y-2 text-xs text-slate-700">
                <div className="mb-1 inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-[11px] text-slate-600">
                  <span className="font-semibold">{currentCase.client}</span>
                  <span className="text-slate-400">/</span>
                  <span>{currentCase.title}</span>
                </div>
                <p>{currentCase.prompt}</p>
                <p className="text-[11px] text-slate-500">ヒント：{currentCase.hint}</p>
                <p className="text-[11px] text-slate-500">KPI例：{currentCase.kpiExamples}</p>
              </div>
            ) : (
              <p className="text-xs text-slate-400">
                ケースはまだ選ばれていません。「新しいケースを出す」を押してください。
              </p>
            )}
          </section>

          {/* ② */}
          <section className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
            <h2 className="mb-2 text-sm font-semibold text-slate-800">② ゴールとKPIの再定義</h2>
            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[11px] text-slate-500">ゴール（何を最大化 / 最適化する？）</label>
                <textarea
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white/80 p-2 text-sm outline-none"
                  rows={2}
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-500">KPI（追うべき指標）</label>
                <textarea
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white/80 p-2 text-sm outline-none"
                  rows={2}
                  value={kpi}
                  onChange={(e) => setKpi(e.target.value)}
                />
              </div>
            </div>
          </section>

          {/* ③ */}
          <section className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
            <h2 className="mb-2 text-sm font-semibold text-slate-800">③ フレームワーク & 仮説</h2>
            <div className="grid grid-cols-1 gap-4 text-xs md:grid-cols-2">
              <div>
                <label className="text-[11px] text-slate-500">フレーム / 分解の仕方</label>
                <textarea
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white/80 p-2 text-sm outline-none"
                  rows={4}
                  value={framework}
                  onChange={(e) => setFramework(e.target.value)}
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-500">初期仮説（1〜2行でOK）</label>
                <textarea
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white/80 p-2 text-sm outline-none"
                  rows={4}
                  value={hypothesis}
                  onChange={(e) => setHypothesis(e.target.value)}
                />
              </div>
            </div>
          </section>

          {/* ④ */}
          <section className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
            <h2 className="mb-2 text-sm font-semibold text-slate-800">④ 深掘りの進め方 & 分析</h2>
            <div className="grid grid-cols-1 gap-4 text-xs md:grid-cols-2">
              <div>
                <label className="text-[11px] text-slate-500">何から確認する？（深掘り順序）</label>
                <textarea
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white/80 p-2 text-sm outline-none"
                  rows={4}
                  value={deepDivePlan}
                  onChange={(e) => setDeepDivePlan(e.target.value)}
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-500">分析メモ（数字・示唆）</label>
                <textarea
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white/80 p-2 text-sm outline-none"
                  rows={4}
                  value={analysis}
                  onChange={(e) => setAnalysis(e.target.value)}
                />
              </div>
            </div>
          </section>

          {/* ⑤ */}
          <section className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
            <h2 className="mb-2 text-sm font-semibold text-slate-800">⑤ 打ち手・リスク・まとめ</h2>
            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[11px] text-slate-500">打ち手（3つ以内に絞る）</label>
                <textarea
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white/80 p-2 text-sm outline-none"
                  rows={3}
                  value={solutions}
                  onChange={(e) => setSolutions(e.target.value)}
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-500">リスク & 前提（1〜3行）</label>
                <textarea
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white/80 p-2 text-sm outline-none"
                  rows={3}
                  value={risks}
                  onChange={(e) => setRisks(e.target.value)}
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-500">クロージング（結論→理由→次アクション）</label>
                <textarea
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white/80 p-2 text-sm outline-none"
                  rows={3}
                  value={wrapUp}
                  onChange={(e) => setWrapUp(e.target.value)}
                />
              </div>
            </div>
          </section>

          {/* 評価 */}
          <section className="mb-6 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleEvaluate}
              disabled={isEvaluating || !currentCase}
              className={`rounded-full px-5 py-2 text-xs font-semibold text-white ${
                isEvaluating || !currentCase
                  ? "cursor-not-allowed bg-slate-300"
                  : "bg-violet-500 hover:bg-violet-600"
              }`}
            >
              {isEvaluating ? "評価中…" : "AIに評価してもらう"}
            </button>
          </section>
        </div>

        {/* 右：スコア & フィードバック */}
        <aside className="w-72 shrink-0 space-y-4">
          <div className="rounded-2xl border border-sky-100 bg-sky-50/80 p-4 shadow-sm">
            <h3 className="mb-2 text-xs font-semibold tracking-wide text-sky-700">
              ケース構造スコア
            </h3>
            <p className="mb-2 text-[11px] text-sky-800">OpenAI評価の結果を反映しています。</p>

            <ul className="space-y-1.5 text-xs text-slate-700">
              <li className="flex justify-between">
                <span>構造化（MECE）</span>
                <span className="font-semibold">{score.structure}/10</span>
              </li>
              <li className="flex justify-between">
                <span>仮説の切れ味</span>
                <span className="font-semibold">{score.hypothesis}/10</span>
              </li>
              <li className="flex justify-between">
                <span>示唆・インサイト</span>
                <span className="font-semibold">{score.insight}/10</span>
              </li>
              <li className="flex justify-between">
                <span>実現可能性</span>
                <span className="font-semibold">{score.practicality}/10</span>
              </li>
              <li className="flex justify-between">
                <span>伝え方・一貫性</span>
                <span className="font-semibold">{score.communication}/10</span>
              </li>
            </ul>

            {typeof totalScore === "number" && (
              <div className="mt-3 rounded-xl border border-slate-100 bg-white/80 p-3">
                <p className="text-[11px] text-slate-500">合計（暫定）</p>
                <p className="text-2xl font-semibold text-slate-900">{totalScore}</p>
                <p className="mt-1 text-[11px] text-slate-500">※ 50点満点想定</p>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white/90 p-4 shadow-sm">
            <h3 className="mb-2 text-xs font-semibold text-slate-800">フィードバック（文章）</h3>
            {feedback ? (
              <div className="space-y-2 text-[11px] text-slate-700">
                <p>{feedback.summary}</p>
                <div>
                  <p className="mb-1 font-semibold text-slate-800">◎ 良い点</p>
                  <pre className="whitespace-pre-wrap">{feedback.goodPoints}</pre>
                </div>
                <div>
                  <p className="mb-1 font-semibold text-slate-800">▲ 改善ポイント</p>
                  <pre className="whitespace-pre-wrap">{feedback.improvePoints}</pre>
                </div>
                <div>
                  <p className="mb-1 font-semibold text-slate-800">▶ 次にやると良いこと</p>
                  <pre className="whitespace-pre-wrap">{feedback.nextTraining}</pre>
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-slate-400">
                ここにAIからの良い点・改善点・次にやる練習が表示されます。
              </p>
            )}
          </div>
        </aside>
      </div>

      {/* ✅ 共通METAモーダル */}
      <MetaConfirmModal
        open={metaModalOpen}
        onClose={closeMetaModal}
        featureLabel={FEATURE_LABEL}
        requiredMeta={metaNeed}
        balance={metaBalance}
        mode={metaMode}
        title={metaTitle}
        message={metaMessage}
        onConfirm={async () => {
          // ✅ confirm押下時に必ず「最新残高」を見て、不足なら purchaseへ飛ばす
          const required = metaNeed;
          const latest = await fetchMyBalance();
          if (typeof latest === "number") setMetaBalance(latest);

          if (typeof latest === "number" && latest < required) {
            closeMetaModal();
            router.push("/pricing");
            return;
          }

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
