// src/components/FermiEstimateAI.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { MetaConfirmModal } from "@/components/MetaConfirmModal";

/* ============================
   型定義
============================ */
type Plan = "free" | "pro";

type FermiCategory = "daily" | "business" | "consulting";
type FermiDifficulty = "easy" | "medium" | "hard";

type FermiProblem = {
  id: string;
  category: FermiCategory;
  difficulty: FermiDifficulty;
  title: string;
  formulaHint: string;
  defaultFactors: string[];
  unit: string;
};

type FermiFactor = {
  id: number;
  name: string;
  operator: "×" | "+";
  assumption: string;
  rationale: string;
  value: string;
};

type FermiScore = {
  reframing: number;
  decomposition: number;
  assumptions: number;
  numbersSense: number;
  sanityCheck: number;
};

type FermiFeedback = {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  advice: string;
  sampleAnswer: string;
  totalScore: number;
};

type ProceedMode = "unlimited" | "free" | "need_meta";

// generation_jobs/status の返却想定
type JobStatus = "queued" | "running" | "blocked" | "succeeded" | "failed" | string;

type GenerationJob = {
  id: string;
  status: JobStatus;
  result: any | null;
  error_code: string | null;
  error_message: string | null;
  updated_at: string | null;
  created_at: string | null;
};

type ApiErr = {
  ok?: false;
  error?: string;
  message?: string;
  requiredMeta?: number;
  required?: number;
  balance?: number;
};

/* ============================
   定数
============================ */
const FEATURE_LABEL = "フェルミ推定AI";
const FEATURE_ID_EVAL = "fermi"; // ✅ eval/fermi の feature_id と一致
const FEATURE_ID_GEN = "fermi_generate"; // ✅ fermi/new の feature_id と一致想定（API側と合わせてね）
const DEFAULT_GEN_COUNT = 10;

// localStorage keys
const LS_KEY_EVAL = "genjob:fermi_eval:key";
const LS_KEY_GEN = "genjob:fermi_gen:key";
const LS_KEY_SESSION_PREFIX = "fermi_session:v2";

/* ============================
   ユーティリティ
============================ */
function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function uniqById<T extends { id: string }>(arr: T[]) {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const x of arr) {
    if (!x?.id) continue;
    if (seen.has(x.id)) continue;
    seen.add(x.id);
    out.push(x);
  }
  return out;
}

function hashStringDjb2(input: string) {
  let h = 5381;
  for (let i = 0; i < input.length; i++) h = (h * 33) ^ input.charCodeAt(i);
  return (h >>> 0).toString(16);
}

function makeEvalIdempotencyKey(payload: any) {
  const s = JSON.stringify(payload ?? {});
  return `fermi_eval_${hashStringDjb2(s)}_${s.length}`;
}

function genUuid() {
  try {
    // @ts-ignore
    if (typeof crypto !== "undefined" && crypto?.randomUUID) return crypto.randomUUID();
  } catch {}
  return `${Date.now()}_${Math.random().toString(16).slice(2)}_${Math.random()
    .toString(16)
    .slice(2)}`;
}

function makeGenIdempotencyKey(category: FermiCategory, difficulty: FermiDifficulty) {
  return `fermi_gen_${category}_${difficulty}_${genUuid()}`;
}

/* ============================
   Session 型（Caseと同じ思想）
============================ */
type FermiSession = {
  v: 2;
  category: FermiCategory;
  difficulty: FermiDifficulty;

  problemPool: FermiProblem[];
  poolIndex: number;

  currentProblem: FermiProblem | null;

  inputs: {
    question: string;
    formula: string;
    unit: string;
    factors: FermiFactor[];
    result: string;
    sanityComment: string;
  };

  eval: {
    score: FermiScore;
    feedback: FermiFeedback | null;
    lastLogId: number | string | null;
  };

  updatedAt: string; // ISO
};

/* ============================
   メイン
============================ */
type Props = {
  onEvaluated?: () => void;
  };
  export const FermiEstimateAI: React.FC<Props> = ({ onEvaluated }) => {
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

  // 互換（表示用）
  const [plan, setPlan] = useState<Plan>("free");
  const [remaining, setRemaining] = useState<number | null>(null);

  // selector
  const [category, setCategory] = useState<FermiCategory>("business");
  const [difficulty, setDifficulty] = useState<FermiDifficulty>("medium");

  // pool
  const [problemPool, setProblemPool] = useState<FermiProblem[]>([]);
  const [poolIndex, setPoolIndex] = useState(0);
  const [currentProblem, setCurrentProblem] = useState<FermiProblem | null>(null);

  // inputs
  const [question, setQuestion] = useState("");
  const [formula, setFormula] = useState("");
  const [unit, setUnit] = useState("件 / 年");
  const [factors, setFactors] = useState<FermiFactor[]>([]);
  const [result, setResult] = useState<string>("");
  const [sanityComment, setSanityComment] = useState("");

  // eval
  const [score, setScore] = useState<FermiScore>({
    reframing: 0,
    decomposition: 0,
    assumptions: 0,
    numbersSense: 0,
    sanityCheck: 0,
  });
  const [feedback, setFeedback] = useState<FermiFeedback | null>(null);
  const [lastLogId, setLastLogId] = useState<number | string | null>(null);

  // ui
  const [uiError, setUiError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);

  // ✅ 実行中ジョブkey（復帰用）
  const [activeGenKey, setActiveGenKey] = useState<string | null>(null);
  const [activeEvalKey, setActiveEvalKey] = useState<string | null>(null);

  // ✅ ポーリング停止
  const pollingAbortRef = useRef<{ gen: boolean; eval: boolean }>({ gen: false, eval: false });

  // ✅ MetaConfirmModal（Caseと同型）
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

  /* -------------------------
     localStorage helpers
  ------------------------- */
  const makeSessionKey = (uid: string) => `${LS_KEY_SESSION_PREFIX}:${uid}`;

  const saveSession = (s: FermiSession) => {
    try {
      if (!userId) return;
      localStorage.setItem(makeSessionKey(userId), JSON.stringify(s));
    } catch {}
  };

  const loadSession = (): FermiSession | null => {
    try {
      if (!userId) return null;
      const raw = localStorage.getItem(makeSessionKey(userId));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed?.v !== 2) return null;
      return parsed as FermiSession;
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

  const setLocalKey = (kind: "gen" | "eval", key: string) => {
    try {
      localStorage.setItem(kind === "gen" ? LS_KEY_GEN : LS_KEY_EVAL, key);
    } catch {}
  };
  const getLocalKey = (kind: "gen" | "eval") => {
    try {
      return localStorage.getItem(kind === "gen" ? LS_KEY_GEN : LS_KEY_EVAL);
    } catch {
      return null;
    }
  };
  const clearLocalKey = (kind: "gen" | "eval") => {
    try {
      localStorage.removeItem(kind === "gen" ? LS_KEY_GEN : LS_KEY_EVAL);
    } catch {}
  };

  /* -------------------------
     META残高（GET統一）
  ------------------------- */
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
     表示用：問題の初期化
  ------------------------- */
  const resetForNewProblem = () => {
    setResult("");
    setSanityComment("");
    setUiError(null);
    setFeedback(null);
    setLastLogId(null);
    setScore({
      reframing: 0,
      decomposition: 0,
      assumptions: 0,
      numbersSense: 0,
      sanityCheck: 0,
    });
  };

  const materializeProblem = (problem: FermiProblem) => {
    setCurrentProblem(problem);
    setQuestion(problem.title);
    setFormula(problem.formulaHint);
    setUnit(problem.unit);

    resetForNewProblem();

    setFactors(
      (problem.defaultFactors ?? []).map((name, idx) => ({
        id: Date.now() + idx,
        name,
        operator: "×",
        assumption: "",
        rationale: "",
        value: "",
      }))
    );

    // ✅ 問題切り替え時、eval復帰キーは混線防止で消す（Caseと同じ）
    clearLocalKey("eval");
    setActiveEvalKey(null);
  };

  const showPoolIndex = (idx: number) => {
    const p = problemPool[idx];
    if (!p) return;
    setPoolIndex(idx);
    materializeProblem(p);
  };

  /* -------------------------
     ✅ セッション復元（プール/入力/評価）
     - 次の「10問生成」を押すまで保持
  ------------------------- */
  useEffect(() => {
    if (authLoading) return;
    if (!userId) return;

    const s = loadSession();
    if (!s) return;

    setCategory(s.category);
    setDifficulty(s.difficulty);

    setProblemPool(s.problemPool ?? []);
    setPoolIndex(typeof s.poolIndex === "number" ? s.poolIndex : 0);

    setCurrentProblem(s.currentProblem);

    setQuestion(s.inputs.question);
    setFormula(s.inputs.formula);
    setUnit(s.inputs.unit);
    setFactors(Array.isArray(s.inputs.factors) ? s.inputs.factors : []);
    setResult(s.inputs.result);
    setSanityComment(s.inputs.sanityComment);

    setScore(s.eval.score);
    setFeedback(s.eval.feedback);
    setLastLogId(s.eval.lastLogId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, userId]);

  /* -------------------------
     ✅ セッション自動保存（入力中/評価後も保持）
  ------------------------- */
  const saveTimerRef = useRef<any>(null);

  useEffect(() => {
    if (!userId) return;
    if (!currentProblem) return; // 未開始は保存しない

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    saveTimerRef.current = setTimeout(() => {
      const session: FermiSession = {
        v: 2,
        category,
        difficulty,
        problemPool,
        poolIndex,
        currentProblem,
        inputs: {
          question,
          formula,
          unit,
          factors,
          result,
          sanityComment,
        },
        eval: {
          score,
          feedback,
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
    category,
    difficulty,
    problemPool,
    poolIndex,
    currentProblem,
    question,
    formula,
    unit,
    factors,
    result,
    sanityComment,
    score,
    feedback,
    lastLogId,
  ]);

  /* -------------------------
     共通：generation_jobs/status
  ------------------------- */
  const fetchJobStatus = async (feature: string, key: string): Promise<GenerationJob | null> => {
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
    feature: string;
    key: string;
    kind: "gen" | "eval";
    onSucceeded: (result: any) => Promise<void> | void;
    onFailed: (job: GenerationJob) => Promise<void> | void;
    maxTries?: number;
  }) => {
    const { feature, key, kind, onSucceeded, onFailed, maxTries = 120 } = params;

    for (let i = 0; i < maxTries; i++) {
      if (kind === "gen" && pollingAbortRef.current.gen) return;
      if (kind === "eval" && pollingAbortRef.current.eval) return;

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
        // blocked は API が「課金待ち結果保持」をする設計ならここで止めて metaConfirm を出すのも可
      }

      await sleep(900);
    }

    setUiError("処理がタイムアウトしました。もう一度お試しください。");
  };

  /* -------------------------
     計算
  ------------------------- */
  const handleCompute = () => {
    try {
      if (!factors.length) return setResult("");
      const nums = factors.map((f) => Number(f.value || "0") || 0);
      let acc = nums[0] ?? 0;
      for (let i = 1; i < nums.length; i++) {
        const op = factors[i]?.operator ?? "×";
        acc = op === "+" ? acc + nums[i] : acc * nums[i];
      }
      setResult(`${acc.toExponential(2)} ${unit}（概算）`);
    } catch {
      setResult("計算エラー（入力値を確認してください）");
    }
  };

  const addFactor = () => {
    setFactors((prev) => [
      ...prev,
      { id: Date.now(), name: "", operator: "×", assumption: "", rationale: "", value: "" },
    ]);
  };

  const updateFactor = (id: number, field: keyof FermiFactor, value: string) => {
    setFactors((prev) => prev.map((f) => (f.id === id ? { ...f, [field]: value } : f)));
  };

  /* -------------------------
     ✅ 生成（job方式 + metaConfirm対応）
  ------------------------- */
  const startGenerateWithKey = async (key: string, metaConfirm: boolean) => {
    pollingAbortRef.current.gen = false;

    const res = await fetch("/api/fermi/new", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Idempotency-Key": key,
        ...(metaConfirm ? { "X-Meta-Confirm": "1" } : {}),
      },
      body: JSON.stringify({ category, difficulty, count: DEFAULT_GEN_COUNT }),
    });

    const data: any = await res.json().catch(() => ({}));

    if (!res.ok && res.status === 402 && data?.error === "need_meta") {
      const requiredMeta = Number(data?.requiredMeta ?? data?.required ?? 1);

      await openMetaModalFor({
        requiredMeta,
        featureLabel: `${FEATURE_LABEL}（問題生成）`,
        onProceed: async () => {
          const b = await fetchMyBalance();
          if (typeof b === "number" && b < requiredMeta) {
            closeMetaModal();
            router.push("/pricing");
            return;
          }

          setIsGenerating(true);
          try {
            await startGenerateWithKey(key, true);
          } finally {
            setIsGenerating(false);
          }
        },
      });

      return;
    }

    if (!res.ok) {
      setUiError(data?.message ?? "問題生成に失敗しました。");
      clearLocalKey("gen");
      setActiveGenKey(null);
      return;
    }

    // 互換表示
    if (data?.plan) setPlan(data.plan as Plan);
    if (typeof data?.remaining === "number") setRemaining(data.remaining);

    // jobが返る設計（queued/running）なら statusで復帰
    if (data?.status === "running" || data?.status === "queued") {
      await pollUntilDone({
        feature: FEATURE_ID_GEN,
        key,
        kind: "gen",
        onSucceeded: async (jobResult) => {
          const fermis = (jobResult?.fermis ?? jobResult?.fermis ?? []) as FermiProblem[];
          const one = jobResult?.fermi as FermiProblem | undefined;

          const list = uniqById(
            (Array.isArray(fermis) && fermis.length ? fermis : one ? [one] : []).filter(Boolean)
          );

          if (!list.length) {
            setUiError("生成結果が不正です（fermi/fermisがありません）");
            clearLocalKey("gen");
            setActiveGenKey(null);
            return;
          }

          // ✅ 次の問題セット生成時に前セッション破棄（Caseと同じ）
          clearSession();

          setProblemPool(list);
          setPoolIndex(0);
          materializeProblem(list[0]);

          clearLocalKey("gen");
          setActiveGenKey(null);

          const bb = await fetchMyBalance();
          if (typeof bb === "number") setMetaBalance(bb);
        },
        onFailed: async (job) => {
          setUiError(job.error_message ?? "処理に失敗しました。");
          clearLocalKey("gen");
          setActiveGenKey(null);
        },
      });

      return;
    }

    // 即時返却（reused or succeeded）想定
    const fermis = (data?.fermis ?? []) as FermiProblem[];
    const one = data?.fermi as FermiProblem | undefined;

    const list = uniqById(
      (Array.isArray(fermis) && fermis.length ? fermis : one ? [one] : []).filter(Boolean)
    );

    if (!list.length) {
      setUiError("生成結果が不正です（fermi/fermisがありません）");
      clearLocalKey("gen");
      setActiveGenKey(null);
      return;
    }

    // ✅ 次の問題セット生成時に前セッション破棄（Caseと同じ）
    clearSession();

    setProblemPool(list);
    setPoolIndex(0);
    materializeProblem(list[0]);

    clearLocalKey("gen");
    setActiveGenKey(null);

    const bb = await fetchMyBalance();
    if (typeof bb === "number") setMetaBalance(bb);
  };

  const handleGenerate = async () => {
    setUiError(null);
    if (!userId) return setUiError("ログインが必要です。");

    const key = makeGenIdempotencyKey(category, difficulty);
    setActiveGenKey(key);
    setLocalKey("gen", key);

    setIsGenerating(true);
    try {
      await startGenerateWithKey(key, false);
    } catch (e) {
      console.error(e);
      setUiError("通信エラーが発生しました。時間をおいて再度お試しください。");
      clearLocalKey("gen");
      setActiveGenKey(null);
    } finally {
      setIsGenerating(false);
    }
  };

  /* -------------------------
     ✅ 評価（job方式 + metaConfirm対応）
  ------------------------- */
  const applyEvalResult = async (resultObj: any) => {
    const sc = resultObj?.score ?? null;
    const fb = resultObj?.feedback ?? null;
    const lg = resultObj?.logId ?? null;

    if (!sc || !fb) {
      setUiError("AI評価の結果が取得できませんでした。");
      return;
    }

    setScore(sc as FermiScore);
    setFeedback(fb as FermiFeedback);
    setLastLogId(lg);
  };

  const startEvalWithKey = async (key: string, metaConfirm: boolean, payload: any) => {
    pollingAbortRef.current.eval = false;

    const res = await fetch("/api/eval/fermi", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Idempotency-Key": key,
        ...(metaConfirm ? { "X-Meta-Confirm": "1" } : {}),
      },
      body: JSON.stringify(payload),
    });

    const data: any = await res.json().catch(() => ({}));

    if (!res.ok && res.status === 402 && data?.error === "need_meta") {
      const requiredMeta = Number(data?.requiredMeta ?? data?.required ?? 1);

      await openMetaModalFor({
        requiredMeta,
        featureLabel: `${FEATURE_LABEL}（採点）`,
        onProceed: async () => {
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

    if (!res.ok) {
      setUiError(data?.message ?? "AI採点に失敗しました。");
      clearLocalKey("eval");
      setActiveEvalKey(null);
      return;
    }

    // jobが返る設計（running/queued）なら statusで確定
    if (data?.status === "running" || data?.status === "queued") {
      await pollUntilDone({
        feature: FEATURE_ID_EVAL,
        key,
        kind: "eval",
        onSucceeded: async (jobResult) => {
          await applyEvalResult(jobResult);

          onEvaluated?.();

          clearLocalKey("eval");
          setActiveEvalKey(null);

          const bb = await fetchMyBalance();
          if (typeof bb === "number") setMetaBalance(bb);
        },
        onFailed: async (job) => {
          setUiError(job.error_message ?? "処理に失敗しました。");
          clearLocalKey("eval");
          setActiveEvalKey(null);
        },
      });
      return;
    }

    // 即時結果（reused含む）
    await applyEvalResult(data);

    onEvaluated?.();

    clearLocalKey("eval");
    setActiveEvalKey(null);

    const bb = await fetchMyBalance();
    if (typeof bb === "number") setMetaBalance(bb);
  };

  const handleEvaluate = async () => {
    setUiError(null);

    if (!userId) return setUiError("ログインが必要です。");
    if (!currentProblem) return setUiError("まずは問題セットを生成してください。");
    if (!question.trim()) return setUiError("お題（Question）を入力してください。");
    if (isEvaluating) return;

    const totalLen =
      question.length +
      formula.length +
      unit.length +
      (sanityComment?.length ?? 0) +
      (result?.length ?? 0) +
      factors.reduce(
        (acc, f) =>
          acc +
          (f.name?.length ?? 0) +
          (f.assumption?.length ?? 0) +
          (f.rationale?.length ?? 0) +
          (f.value?.length ?? 0),
        0
      );

    if (totalLen < 60) {
      setUiError("もう少し埋めてから評価してみて！目安：合計60文字以上。");
      return;
    }

    // 評価表示を一旦リセット
    setFeedback(null);
    setLastLogId(null);
    setScore({
      reframing: 0,
      decomposition: 0,
      assumptions: 0,
      numbersSense: 0,
      sanityCheck: 0,
    });

    const payload = {
      question,
      formula,
      unit,
      factors,
      sanityComment,
      result,
      problemId: currentProblem.id,
      category,
      difficulty,
    };

    const key = makeEvalIdempotencyKey(payload);
    setActiveEvalKey(key);
    setLocalKey("eval", key);

    setIsEvaluating(true);
    try {
      await startEvalWithKey(key, false, payload);
    } catch (e) {
      console.error(e);
      setUiError("通信エラーが発生しました。時間をおいて再度お試しください。");
      clearLocalKey("eval");
      setActiveEvalKey(null);
    } finally {
      setIsEvaluating(false);
    }
  };

  /* -------------------------
     ✅ リロード復帰（gen/eval）
  ------------------------- */
  useEffect(() => {
    if (authLoading) return;
    if (!userId) return;

    const resume = async () => {
      // eval
      const ek = getLocalKey("eval");
      if (ek) {
        setActiveEvalKey(ek);
        setIsEvaluating(true);

        try {
          const job = await fetchJobStatus(FEATURE_ID_EVAL, ek);
          if (!job) {
            clearLocalKey("eval");
            setActiveEvalKey(null);
          } else if (job.status === "succeeded") {
            await applyEvalResult(job.result);

            onEvaluated?.();

            clearLocalKey("eval");
            setActiveEvalKey(null);

            const bb = await fetchMyBalance();
            if (typeof bb === "number") setMetaBalance(bb);
          } else if (job.status === "failed") {
            setUiError(job.error_message ?? "処理に失敗しました。");
            clearLocalKey("eval");
            setActiveEvalKey(null);
          } else {
            await pollUntilDone({
              feature: FEATURE_ID_EVAL,
              key: ek,
              kind: "eval",
              onSucceeded: async (r) => {
                await applyEvalResult(r);

                onEvaluated?.();

                clearLocalKey("eval");
                setActiveEvalKey(null);

                const bb = await fetchMyBalance();
                if (typeof bb === "number") setMetaBalance(bb);
              },
              onFailed: async (j) => {
                setUiError(j.error_message ?? "処理に失敗しました。");
                clearLocalKey("eval");
                setActiveEvalKey(null);
              },
            });
          }
        } finally {
          setIsEvaluating(false);
        }
      }

      // gen
      const gk = getLocalKey("gen");
      if (gk) {
        setActiveGenKey(gk);
        setIsGenerating(true);

        try {
          const job = await fetchJobStatus(FEATURE_ID_GEN, gk);
          if (!job) {
            clearLocalKey("gen");
            setActiveGenKey(null);
          } else if (job.status === "succeeded") {
            const fermis = (job.result?.fermis ?? []) as FermiProblem[];
            const one = job.result?.fermi as FermiProblem | undefined;
            const list = uniqById(
              (Array.isArray(fermis) && fermis.length ? fermis : one ? [one] : []).filter(Boolean)
            );

            if (list.length) {
              clearSession();
              setProblemPool(list);
              setPoolIndex(0);
              materializeProblem(list[0]);
            }

            clearLocalKey("gen");
            setActiveGenKey(null);

            const bb = await fetchMyBalance();
            if (typeof bb === "number") setMetaBalance(bb);
          } else if (job.status === "failed") {
            setUiError(job.error_message ?? "処理に失敗しました。");
            clearLocalKey("gen");
            setActiveGenKey(null);
          } else {
            await pollUntilDone({
              feature: FEATURE_ID_GEN,
              key: gk,
              kind: "gen",
              onSucceeded: async (r) => {
                const fermis = (r?.fermis ?? []) as FermiProblem[];
                const one = r?.fermi as FermiProblem | undefined;
                const list = uniqById(
                  (Array.isArray(fermis) && fermis.length ? fermis : one ? [one] : []).filter(Boolean)
                );

                if (list.length) {
                  clearSession();
                  setProblemPool(list);
                  setPoolIndex(0);
                  materializeProblem(list[0]);
                }

                clearLocalKey("gen");
                setActiveGenKey(null);

                const bb = await fetchMyBalance();
                if (typeof bb === "number") setMetaBalance(bb);
              },
              onFailed: async (j) => {
                setUiError(j.error_message ?? "処理に失敗しました。");
                clearLocalKey("gen");
                setActiveGenKey(null);
              },
            });
          }
        } finally {
          setIsGenerating(false);
        }
      }
    };

    resume();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, userId, onEvaluated]);

  /* -------------------------
     unmount cleanup
  ------------------------- */
  useEffect(() => {
    return () => {
      pollingAbortRef.current.gen = true;
      pollingAbortRef.current.eval = true;
    };
  }, []);

  /* -------------------------
     プール操作
  ------------------------- */
  const canPrev = problemPool.length > 0 && poolIndex > 0;
  const canNext = problemPool.length > 0 && poolIndex < problemPool.length - 1;

  const goPrev = () => {
    if (!canPrev) return;
    showPoolIndex(poolIndex - 1);
  };

  const goNext = () => {
    if (!canNext) return;
    showPoolIndex(poolIndex + 1);
  };

  /* -------------------------
     UI
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
        <div className="flex-1 space-y-6 overflow-y-auto pr-2">
          {(authError || uiError) && (
            <div className="rounded-2xl border border-rose-100 bg-rose-50 p-3 text-xs text-rose-700">
              {authError ?? uiError}
            </div>
          )}

          {/* ガチャ + プール */}
          <section className="mb-2 rounded-2xl border border-sky-100 bg-sky-50/70 p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h1 className="text-sm font-semibold text-sky-900">Fermi Estimation Trainer</h1>
                <p className="mt-1 text-[11px] text-sky-700">
                  カテゴリと難易度を選んで「新しい問題セット(10)」を押すと、フェルミ問題が10問生成されます。
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

                <p className="mt-1 text-[11px] text-sky-700">
                  問題プール: <span className="font-semibold">{problemPool.length || 0}</span>
                  {problemPool.length > 0 && (
                    <>
                      {" "}
                      / 表示中:{" "}
                      <span className="font-semibold">
                        {poolIndex + 1}/{problemPool.length}
                      </span>
                    </>
                  )}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={goPrev}
                  disabled={!canPrev || isEvaluating}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                    canPrev && !isEvaluating
                      ? "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      : "cursor-not-allowed bg-slate-100 text-slate-300"
                  }`}
                >
                  ◀︎ 前
                </button>

                <button
                  type="button"
                  onClick={goNext}
                  disabled={!canNext || isEvaluating}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                    canNext && !isEvaluating
                      ? "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      : "cursor-not-allowed bg-slate-100 text-slate-300"
                  }`}
                >
                  次 ▶︎
                </button>

                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold text-white shadow-sm ${
                    isGenerating ? "cursor-not-allowed bg-slate-300" : "bg-sky-500 hover:bg-sky-600"
                  }`}
                >
                  {isGenerating ? "生成中…" : `🎲 新しい問題セット(${DEFAULT_GEN_COUNT})`}
                </button>
              </div>
            </div>

            <div className="mb-3 grid grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] text-slate-600">カテゴリ</label>
                <select
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white/80 px-2 py-1.5 text-xs"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as FermiCategory)}
                >
                  <option value="daily">Daily（日常）</option>
                  <option value="business">Business</option>
                  <option value="consulting">Consulting</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] text-slate-600">難易度</label>
                <select
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white/80 px-2 py-1.5 text-xs"
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value as FermiDifficulty)}
                >
                  <option value="easy">⭐ Easy</option>
                  <option value="medium">⭐⭐ Medium</option>
                  <option value="hard">⭐⭐⭐ Hard</option>
                </select>
              </div>

              <div className="flex items-end">
                <p className="w-full text-[11px] text-slate-500">
                  {currentProblem ? (
                    <>
                      現在の問題ID: <span className="font-mono">{currentProblem.id}</span>
                    </>
                  ) : (
                    `まずは「新しい問題セット(${DEFAULT_GEN_COUNT})」でスタート。`
                  )}
                </p>
              </div>
            </div>

            {/* ✅ プール内ジャンプ */}
            {problemPool.length > 0 && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-[11px] text-slate-600">ジャンプ：</span>
                <select
                  className="w-72 rounded-xl border border-slate-200 bg-white/80 px-2 py-1.5 text-xs"
                  value={poolIndex}
                  onChange={(e) => showPoolIndex(Number(e.target.value))}
                  disabled={isEvaluating}
                >
                  {problemPool.map((p, i) => (
                    <option key={p.id} value={i}>
                      {String(i + 1).padStart(2, "0")}. {p.title.slice(0, 28)}
                      {p.title.length > 28 ? "…" : ""}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  className="ml-auto rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-600 hover:bg-slate-50"
                  onClick={() => {
                    if (problemPool[poolIndex]) materializeProblem(problemPool[poolIndex]);
                  }}
                  disabled={!problemPool[poolIndex] || isEvaluating}
                >
                  今の問題を初期状態に戻す
                </button>
              </div>
            )}
          </section>

          {/* ① 再定義 */}
          <section className="rounded-2xl border border-slate-200 bg-white/70 p-4 shadow-sm">
            <h2 className="mb-2 text-sm font-semibold text-slate-700">① 問題の再定義（Reframe）</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-500">お題 / Question</label>
                <textarea
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white/80 p-2 text-sm"
                  rows={2}
                  placeholder="例：日本のカフェ市場規模は？"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="text-xs text-slate-500">式（Formula）</label>
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white/80 px-2 py-1.5 text-sm"
                    placeholder="人口 × 利用割合 × 年間利用回数 × 平均単価"
                    value={formula}
                    onChange={(e) => setFormula(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-500">単位（Unit）</label>
                  <select
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white/80 px-2 py-1.5 text-sm"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                  >
                    <option>件 / 年</option>
                    <option>円 / 年</option>
                    <option>円 / 月</option>
                    <option>人</option>
                    <option>台</option>
                    <option>杯 / 年</option>
                  </select>
                </div>
              </div>
            </div>
          </section>

          {/* ② 要素分解 */}
          <section className="rounded-2xl border border-slate-200 bg-white/70 p-4 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700">② 要素分解（MECE）</h2>
              <button
                type="button"
                className="rounded-lg border border-sky-200 px-2.5 py-1 text-xs text-sky-700 hover:bg-sky-50"
                onClick={addFactor}
              >
                要因を追加
              </button>
            </div>
            <p className="mb-2 text-xs text-slate-500">
              最低 2〜3 要因に分解し、「掛け算 or 足し算」を意識する。
            </p>

            <div className="space-y-3">
              {factors.map((factor, index) => (
                <div key={factor.id} className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] text-slate-600">
                      Factor {index + 1}
                    </span>

                    <select
                      className="rounded-lg border border-slate-200 bg-white/80 px-1.5 py-1 text-[11px]"
                      value={factor.operator}
                      onChange={(e) =>
                        updateFactor(factor.id, "operator", e.target.value as "×" | "+")
                      }
                    >
                      <option value="×">掛け算（×）</option>
                      <option value="+">足し算（＋）</option>
                    </select>

                    <input
                      className="flex-1 rounded-lg border border-slate-200 bg-white/80 px-2 py-1 text-xs"
                      placeholder="例：年間利用回数"
                      value={factor.name}
                      onChange={(e) => updateFactor(factor.id, "name", e.target.value)}
                    />
                  </div>

                  <div className="mb-2 grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-500">仮定（Assumption）</label>
                      <input
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white/80 px-2 py-1 text-xs"
                        value={factor.assumption}
                        onChange={(e) => updateFactor(factor.id, "assumption", e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-500">根拠（Reason）</label>
                      <input
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white/80 px-2 py-1 text-xs"
                        value={factor.rationale}
                        onChange={(e) => updateFactor(factor.id, "rationale", e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-500">数値</label>
                    <input
                      className="mt-1 w-40 rounded-lg border border-slate-200 bg-white/80 px-2 py-1 text-xs"
                      placeholder="例：50000000"
                      value={factor.value}
                      onChange={(e) => updateFactor(factor.id, "value", e.target.value)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ③ 計算 */}
          <section className="rounded-2xl border border-slate-200 bg-white/70 p-4 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700">③ 計算（Computation）</h2>
              <button
                type="button"
                className="rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-sky-600"
                onClick={handleCompute}
              >
                概算を計算する
              </button>
            </div>
            <div className="min-h-[48px] rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-sm">
              {result || "ここに概算結果が表示されます。"}
            </div>
          </section>

          {/* ④ オーダーチェック */}
          <section className="rounded-2xl border border-slate-200 bg-white/70 p-4 shadow-sm">
            <h2 className="mb-2 text-sm font-semibold text-slate-700">④ オーダーチェック（Sanity Check）</h2>
            <textarea
              className="w-full rounded-xl border border-slate-200 bg-white/80 p-2 text-sm"
              rows={3}
              placeholder="例：スタバ売上や飲食市場と比較して 1〜2桁以内なので妥当。"
              value={sanityComment}
              onChange={(e) => setSanityComment(e.target.value)}
            />
          </section>

          {/* ✅ 評価 */}
          <section className="mb-6 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleEvaluate}
              disabled={isEvaluating || !currentProblem}
              className={`rounded-full px-5 py-2 text-xs font-semibold text-white ${
                isEvaluating || !currentProblem
                  ? "cursor-not-allowed bg-slate-300"
                  : "bg-violet-500 hover:bg-violet-600"
              }`}
            >
              {isEvaluating ? "採点中…" : "AIに採点してもらう"}
            </button>
          </section>

          {/* フィードバック */}
          {feedback && (
            <section className="mb-8 rounded-2xl border border-violet-100 bg-violet-50/60 p-4 shadow-sm">
              <h3 className="mb-2 text-xs font-semibold text-violet-700">フィードバック & 模範回答イメージ</h3>

              <p className="mb-3 text-xs text-slate-700">{feedback.summary}</p>

              <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-slate-100 bg-white/80 p-3">
                  <p className="mb-1 text-[11px] font-semibold text-emerald-600">👍 良いポイント</p>
                  <ul className="list-disc space-y-1 pl-4 text-[11px] text-slate-700">
                    {(feedback.strengths ?? []).map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-xl border border-slate-100 bg-white/80 p-3">
                  <p className="mb-1 text-[11px] font-semibold text-rose-600">⚠ 改善ポイント</p>
                  <ul className="list-disc space-y-1 pl-4 text-[11px] text-slate-700">
                    {(feedback.weaknesses ?? []).map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <p className="mb-2 text-[11px] text-slate-600">アドバイス：{feedback.advice}</p>

              <div className="rounded-xl border border-slate-100 bg-white/90 px-3 py-2">
                <p className="mb-1 text-[11px] font-semibold text-slate-700">模範回答イメージ</p>
                <pre className="whitespace-pre-wrap text-[11px] text-slate-700">{feedback.sampleAnswer}</pre>
              </div>

              {lastLogId != null && (
                <p className="mt-2 text-[10px] text-slate-400">logId: {String(lastLogId)}</p>
              )}
            </section>
          )}
        </div>

        {/* 右カラム：スコア */}
        <aside className="w-64 shrink-0 space-y-4">
          <div className="rounded-2xl border border-sky-100 bg-sky-50/70 p-4 shadow-sm">
            <h3 className="mb-2 text-xs font-semibold tracking-wide text-sky-700">
              型スコア（Fermi Pattern）
            </h3>
            <p className="mb-2 text-[11px] text-sky-800">OpenAI評価の結果を反映しています。</p>
            <ul className="space-y-1.5 text-xs text-slate-700">
              <li className="flex justify-between">
                <span>再定義</span>
                <span className="font-semibold">{score.reframing}/10</span>
              </li>
              <li className="flex justify-between">
                <span>要素分解</span>
                <span className="font-semibold">{score.decomposition}/10</span>
              </li>
              <li className="flex justify-between">
                <span>仮定の質</span>
                <span className="font-semibold">{score.assumptions}/10</span>
              </li>
              <li className="flex justify-between">
                <span>数字感</span>
                <span className="font-semibold">{score.numbersSense}/10</span>
              </li>
              <li className="flex justify-between">
                <span>オーダー感</span>
                <span className="font-semibold">{score.sanityCheck}/10</span>
              </li>
            </ul>
          </div>

          {feedback && (
            <div className="rounded-2xl border border-violet-100 bg-white/80 p-4 shadow-sm">
              <p className="mb-1 text-[11px] text-slate-500">合計スコア</p>
              <p className="text-2xl font-semibold text-slate-900">{feedback.totalScore}</p>
              <p className="mt-1 text-[11px] text-slate-500">※ 50点満点（5軸×10点）</p>
            </div>
          )}
        </aside>
      </div>

      {/* ✅ 共通METAモーダル（Caseと同じ） */}
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
