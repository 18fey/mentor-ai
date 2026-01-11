// src/components/FermiEstimateAI.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { UpgradeModal } from "@/components/UpgradeModal";
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

type GenerateRes = {
  ok: true;
  plan: Plan;
  remaining?: number;
  usedCount?: number;
  limit?: number;
  // 互換：単体
  fermi: FermiProblem;
  // 追加：複数
  fermis?: FermiProblem[];
};

type EvalRes = {
  ok: true;
  plan: Plan;
  remaining?: number;
  usedCount?: number;
  limit?: number;
  score: FermiScore;
  feedback: FermiFeedback;
  totalScore?: number;
  logId?: number | string | null;
};

type SaveItem = {
  id: string;
  attempt_type: string;
  attempt_id: string;
  save_type: "mistake" | "learning" | "retry";
  created_at: string;
};

type SavesListRes = {
  ok: true;
  plan: Plan;
  items: SaveItem[];
};

type ToggleSaveRes = {
  ok: true;
  plan: Plan;
  enabled: boolean;
};

type ApiErr = {
  error?: string;
  code?: string;
  message?: string;
};

type JobStatus = "queued" | "running" | "succeeded" | "failed";

type JobStatusRes = {
  ok: true;
  job: {
    id: string;
    auth_user_id: string;
    feature_id: string;
    idempotency_key: string;
    status: JobStatus;
    request: any;
    result: any;
    error_code: string | null;
    error_message: string | null;
    log_id: string | null;
    created_at: string;
    updated_at: string;
  } | null;
};

type NeedMetaErr = { ok: false; error: "need_meta"; requiredMeta: number };
type GenericErr = { ok: false; error: string; message?: string };

type LastJobInfo = { key: string; createdAt: string };

/* ============================
   定数（固定）
============================ */
const FEATURE_ID_EVAL = "fermi"; // /api/usage/check の feature と揃える
const FEATURE_ID_GEN = "fermi_generate";

const DEFAULT_GEN_COUNT = 10;

/* ============================
   小さなヘルパー（ファイル内完結）
============================ */
function lsKey(featureId: string) {
  return `last_job:${featureId}`;
}
function safeParseLastJob(s: string | null): LastJobInfo | null {
  if (!s) return null;
  try {
    const j = JSON.parse(s);
    if (j && typeof j.key === "string") return j as LastJobInfo;
    return null;
  } catch {
    return null;
  }
}
function setLastJob(featureId: string, key: string) {
  try {
    localStorage.setItem(
      lsKey(featureId),
      JSON.stringify({ key, createdAt: new Date().toISOString() } satisfies LastJobInfo)
    );
  } catch {
    // ignore
  }
}
function clearLastJob(featureId: string) {
  try {
    localStorage.removeItem(lsKey(featureId));
  } catch {
    // ignore
  }
}

// 文字列ハッシュ（同期・軽量）: idempotency用（評価は deterministic でOK）
function hashStringDjb2(input: string) {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = (h * 33) ^ input.charCodeAt(i);
  }
  return (h >>> 0).toString(16);
}
function makeIdempotencyKey(payload: any) {
  const s = JSON.stringify(payload ?? {});
  return `k_${hashStringDjb2(s)}_${s.length}`;
}

// 生成は「無限生成」したいので UUID（ブラウザ標準優先、なければフォールバック）
function genUuid() {
  try {
    // @ts-ignore
    if (typeof crypto !== "undefined" && crypto?.randomUUID) return crypto.randomUUID();
  } catch {
    // ignore
  }
  // fallback
  return `${Date.now()}_${Math.random().toString(16).slice(2)}_${Math.random()
    .toString(16)
    .slice(2)}`;
}
function makeGenIdempotencyKey(category: FermiCategory, difficulty: FermiDifficulty) {
  // category/difficulty を混ぜておくとデバッグしやすい
  return `g_${category}_${difficulty}_${genUuid()}`;
}

async function fetchJobStatus(featureId: string, key: string): Promise<JobStatusRes | null> {
  const url = `/api/generation-jobs/status?feature=${encodeURIComponent(
    featureId
  )}&key=${encodeURIComponent(key)}`;
  const r = await fetch(url, { cache: "no-store" });
  const j = (await r.json().catch(() => null)) as any;
  if (!r.ok) return null;
  return j as JobStatusRes;
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

/* ============================
   メインコンポーネント
============================ */
export const FermiEstimateAI: React.FC = () => {
  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  // auth
  const [isAuthed, setIsAuthed] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Plan / remaining
  const [plan, setPlan] = useState<Plan>("free");
  const [remaining, setRemaining] = useState<number | null>(null);

  // 問題設定
  const [category, setCategory] = useState<FermiCategory>("business");
  const [difficulty, setDifficulty] = useState<FermiDifficulty>("medium");

  // ✅ 50問プール（タブごと）
  const [problemPool, setProblemPool] = useState<FermiProblem[]>([]);
  const [poolIndex, setPoolIndex] = useState<number>(0);

  // 現在の問題
  const [currentProblemId, setCurrentProblemId] = useState<string | null>(null);

  // 入力
  const [question, setQuestion] = useState("");
  const [formula, setFormula] = useState("");
  const [unit, setUnit] = useState("件 / 年");
  const [factors, setFactors] = useState<FermiFactor[]>([]);
  const [result, setResult] = useState<string>("");
  const [sanityComment, setSanityComment] = useState("");

  // スコア & フィードバック
  const [score, setScore] = useState<FermiScore>({
    reframing: 0,
    decomposition: 0,
    assumptions: 0,
    numbersSense: 0,
    sanityCheck: 0,
  });
  const [feedback, setFeedback] = useState<FermiFeedback | null>(null);

  // 状態
  const [uiError, setUiError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);

  // 🔒 サブスク誘導モーダル（既存）
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeMessage, setUpgradeMessage] = useState<string | undefined>();

  // ✅ 保存
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [lastLogId, setLastLogId] = useState<number | string | null>(null);

  // ✅ META確認モーダル（固定仕様）
  const [metaConfirmOpen, setMetaConfirmOpen] = useState(false);
  const [metaCost, setMetaCost] = useState<number>(1);
  const [metaBalance, setMetaBalance] = useState<number>(0);

  // ✅ meta confirm 再実行用（固定仕様）
  const pendingEvalKeyRef = useRef<string | null>(null);
  const pendingGenKeyRef = useRef<string | null>(null);

  // ✅ meta balance 取得
  const fetchMetaBalance = async (): Promise<number> => {
    const r = await fetch("/api/meta/balance", { cache: "no-store" });
    const j = await r.json().catch(() => null);
    if (!r.ok) return 0;
    return Number(j?.balance ?? 0);
  };

  // auth確認
  useEffect(() => {
    (async () => {
      setAuthError(null);
      const { data, error } = await supabase.auth.getUser();
      if (error || !data?.user?.id) {
        setIsAuthed(false);
        setAuthError(
          "ログイン情報が取得できませんでした。いったんログインし直してください。"
        );
        return;
      }
      setIsAuthed(true);
    })();
  }, [supabase]);

  /* -------------------------------
     UI初期化
  -------------------------------- */
  const resetForNewProblem = () => {
    setResult("");
    setSanityComment("");
    setUiError(null);
    setFeedback(null);
    setSaved(false);
    setLastLogId(null);
    setScore({
      reframing: 0,
      decomposition: 0,
      assumptions: 0,
      numbersSense: 0,
      sanityCheck: 0,
    });
  };

  /* -------------------------------
     問題をUIに反映
  -------------------------------- */
  const materializeProblem = (problem: FermiProblem) => {
    setCurrentProblemId(problem.id);
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
  };

  /* -------------------------------
     プールの指定indexを表示
  -------------------------------- */
  const showPoolIndex = (idx: number) => {
    const p = problemPool[idx];
    if (!p) return;
    setPoolIndex(idx);
    materializeProblem(p);
  };

  /* -------------------------------
     入力条件が変わる操作 → last_job を削除（混線防止：固定仕様）
  -------------------------------- */
  useEffect(() => {
    clearLastJob(FEATURE_ID_GEN);
    clearLastJob(FEATURE_ID_EVAL);

    // ✅ 切り替え時はプールも一旦クリア（古い50問を誤って使わない）
    setProblemPool([]);
    setPoolIndex(0);
    setCurrentProblemId(null);
    setQuestion("");
    setFormula("");
    setFactors([]);
    setResult("");
    setSanityComment("");
    setFeedback(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, difficulty]);

  /* -------------------------------
     起動時の復帰（固定仕様）
     - last_job があれば status で復帰
  -------------------------------- */
  useEffect(() => {
    if (!isAuthed) return;

    let cancelled = false;

    const restoreFeature = async (featureId: string, onSucceeded: (job: any) => void) => {
      const last = safeParseLastJob(localStorage.getItem(lsKey(featureId)));
      if (!last?.key) return;

      const first = await fetchJobStatus(featureId, last.key);
      if (cancelled) return;
      if (!first?.ok || !first.job) return;

      const apply = (job: any) => {
        if (!job) return;
        if (job.status === "succeeded" && job.result) onSucceeded(job);
        if (job.status === "failed" && job.error_message) {
          setUiError(job.error_message);
        }
      };

      apply(first.job);

      // running/queued なら短時間だけポーリング
      if (first.job.status === "running" || first.job.status === "queued") {
        const started = Date.now();
        while (!cancelled && Date.now() - started < 12_000) {
          await new Promise((r) => setTimeout(r, 1200));
          const next = await fetchJobStatus(featureId, last.key);
          if (!next?.ok) continue;
          const job = next.job;
          if (!job) continue;
          if (job.status === "succeeded" || job.status === "failed") {
            apply(job);
            break;
          }
        }
      }
    };

    (async () => {
      // 1) 生成復帰（問題）
      await restoreFeature(FEATURE_ID_GEN, (job) => {
        const fermis = (job?.result?.fermis ?? []) as FermiProblem[];
        const one = job?.result?.fermi as FermiProblem | undefined;

        const list = uniqById(
          (Array.isArray(fermis) && fermis.length ? fermis : one ? [one] : []).filter(Boolean)
        );

        if (list.length) {
          setProblemPool(list);
          setPoolIndex(0);
          materializeProblem(list[0]);
        }
      });

      // 2) 採点復帰（結果）
      await restoreFeature(FEATURE_ID_EVAL, (job) => {
        const sc = job?.result?.score;
        const fb = job?.result?.feedback;
        const lg = job?.result?.logId ?? null;

        if (sc) setScore(sc as FermiScore);
        if (fb) setFeedback(fb as FermiFeedback);
        setLastLogId(lg);
        setSaved(false);
      });
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthed]);

  /* -------------------------------
     生成（MetaConfirm込み）実行
  -------------------------------- */
  const runGenerate = async (idempotencyKey: string, metaConfirm: boolean) => {
    const requestPayload = { category, difficulty, count: DEFAULT_GEN_COUNT, idempotencyKey };

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (metaConfirm) headers["X-Meta-Confirm"] = "1";

    const res = await fetch("/api/fermi/new", {
      method: "POST",
      headers,
      body: JSON.stringify(requestPayload),
    });

    const json = (await res.json().catch(() => null)) as
      | (GenerateRes & { jobId?: string; idempotencyKey?: string; reused?: boolean; status?: JobStatus })
      | NeedMetaErr
      | ApiErr
      | GenericErr
      | null;

    if (!res.ok) {
      if (res.status === 402 && (json as any)?.error === "need_meta") {
        const cost = Number((json as any)?.requiredMeta ?? 1);
        const balance = await fetchMetaBalance();

        setMetaCost(cost);
        setMetaBalance(balance);

        if (balance < cost) {
          setUpgradeMessage("METAが不足しています。購入してください。");
          setUpgradeOpen(true);
          return;
        }

        pendingGenKeyRef.current = idempotencyKey;
        setMetaConfirmOpen(true);
        return;
      }

      if (res.status === 401) {
        setUiError("ログインが必要です。いったんログインし直してください。");
        return;
      }

      setUiError((json as any)?.message ?? "問題生成に失敗しました。");
      return;
    }

    const data = json as any;
    setPlan((data?.plan ?? "free") as Plan);
    if (typeof data.remaining === "number") setRemaining(data.remaining);

    if (data?.status === "running" || data?.status === "queued") {
      return;
    }

    const fermis = (data?.fermis ?? []) as FermiProblem[];
    const one = data?.fermi as FermiProblem | undefined;

    const list = uniqById(
      (Array.isArray(fermis) && fermis.length ? fermis : one ? [one] : []).filter(Boolean)
    );

    if (!list.length) {
      setUiError("生成結果が不正です（fermi/fermisがありません）");
      return;
    }

    setProblemPool(list);
    setPoolIndex(0);
    materializeProblem(list[0]);

    // meta表示更新（ヘッダーが listen してる想定）
    window.dispatchEvent(new Event("meta:refresh"));
  };

  /* -------------------------------
     新規問題生成（ジョブ方式：固定仕様 + 50問プール）
  -------------------------------- */
  const generateNewProblem = async () => {
    setUiError(null);

    if (!isAuthed) {
      setUiError("ログインが必要です。");
      return;
    }

    try {
      setIsGenerating(true);

      // ✅ 生成は無限にしたいので「毎回ランダムkey」
      const idempotencyKey = makeGenIdempotencyKey(category, difficulty);

      // localStorage: last_job を保存（固定仕様）
      setLastJob(FEATURE_ID_GEN, idempotencyKey);

      await runGenerate(idempotencyKey, false);
    } catch (e) {
      console.error(e);
      setUiError("通信エラーが発生しました。時間をおいて再度お試しください。");
    } finally {
      setIsGenerating(false);
    }
  };

  /* -------------------------------
     要因操作
  -------------------------------- */
  const addFactor = () => {
    setFactors((prev) => [
      ...prev,
      {
        id: Date.now(),
        name: "",
        operator: "×",
        assumption: "",
        rationale: "",
        value: "",
      },
    ]);
  };

  const updateFactor = (id: number, field: keyof FermiFactor, value: string) => {
    setFactors((prev) =>
      prev.map((f) => (f.id === id ? { ...f, [field]: value } : f))
    );
  };

  /* -------------------------------
     計算
  -------------------------------- */
  const handleCompute = () => {
    try {
      if (!factors.length) {
        setResult("");
        return;
      }

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

  /* -------------------------------
     AI採点 実行本体（ジョブ方式）
     - idempotencyKey を必ず渡す
     - metaConfirm 時は X-Meta-Confirm:1 & 同じ key を使う（固定仕様）
  -------------------------------- */
  const runEvaluate = async (idempotencyKey: string, metaConfirm: boolean) => {
    const payload = {
      idempotencyKey,
      question,
      formula,
      unit,
      factors,
      sanityComment,
      result,
      problemId: currentProblemId,
      category,
      difficulty,
    };

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (metaConfirm) headers["X-Meta-Confirm"] = "1";

    const res = await fetch("/api/eval/fermi", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    const json = (await res.json().catch(() => null)) as
      | (EvalRes & { jobId?: string; idempotencyKey?: string; reused?: boolean; status?: JobStatus })
      | NeedMetaErr
      | ApiErr
      | GenericErr
      | any;

    if (!res.ok) {
      // ✅ need_meta（二段階：固定仕様）
      if (res.status === 402 && json?.error === "need_meta") {
        const cost = Number(json?.requiredMeta ?? 1);
        const balance = await fetchMetaBalance();

        setMetaCost(cost);
        setMetaBalance(balance);

        // 残高不足 → purchase導線（既存導線維持）
        if (balance < cost) {
          setUpgradeMessage("METAが不足しています。購入してください。");
          setUpgradeOpen(true);
          return;
        }

        // 残高あり → モーダル（confirm後に同じkeyで再実行）
        pendingEvalKeyRef.current = idempotencyKey;
        setMetaConfirmOpen(true);
        return;
      }

      if (res.status === 401) {
        setUiError("ログインが必要です。いったんログインし直してください。");
        return;
      }

      setUiError(json?.message ?? "AI採点に失敗しました。");
      return;
    }

    // running/queued は最小限：復帰ポーリングに任せる
    if (json?.status === "running" || json?.status === "queued") {
      return;
    }

    const data = json as EvalRes;
    setPlan(data.plan ?? plan);

    if (data.score) setScore(data.score);
    if (data.feedback) setFeedback(data.feedback);

    setLastLogId(data.logId ?? null);
    setSaved(false);

    window.dispatchEvent(new Event("meta:refresh"));
  };

  /* -------------------------------
     AI採点（入口）
     - ジョブ方式に統一：idempotencyKey を作り last_job 保存
  -------------------------------- */
  const handleEvaluate = async () => {
    setUiError(null);

    if (!isAuthed) return setUiError("ログインが必要です。");
    if (!question.trim()) return setUiError("お題（Question）を入力してください。");

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

    try {
      setIsEvaluating(true);

      // ✅ 評価は同一入力の二重実行を避けたいので deterministic のまま
      const requestPayload = {
        question,
        formula,
        unit,
        factors,
        sanityComment,
        result,
        problemId: currentProblemId,
        category,
        difficulty,
      };
      const idempotencyKey = makeIdempotencyKey(requestPayload);

      setLastJob(FEATURE_ID_EVAL, idempotencyKey);

      await runEvaluate(idempotencyKey, false);
    } catch (e) {
      console.error(e);
      setUiError("通信エラーが発生しました。時間をおいて再度お試しください。");
    } finally {
      setIsEvaluating(false);
    }
  };

  // ✅ MetaConfirmModal OK押下（同じ key / X-Meta-Confirm:1）
  // - 生成 or 採点 の pending を見て分岐
  const handleMetaConfirm = async () => {
    setMetaConfirmOpen(false);

    // 1) 生成 pending があれば生成を優先
    const genKey = pendingGenKeyRef.current;
    pendingGenKeyRef.current = null;
    if (genKey) {
      try {
        setIsGenerating(true);
        await runGenerate(genKey, true);
      } finally {
        setIsGenerating(false);
      }
      return;
    }

    // 2) 採点 pending
    const evalKey = pendingEvalKeyRef.current;
    pendingEvalKeyRef.current = null;
    if (!evalKey) return;

    try {
      setIsEvaluating(true);
      await runEvaluate(evalKey, true);
    } finally {
      setIsEvaluating(false);
    }
  };

  /* -------------------------
     保存状態チェック
  ------------------------- */
  useEffect(() => {
    if (!lastLogId) return;
    if (!isAuthed) return;

    (async () => {
      try {
        const res = await fetch("/api/saves/list", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ attemptType: "fermi", saveType: "learning", limit: 100 }),
        });

        const json = (await res.json().catch(() => null)) as SavesListRes | ApiErr | null;
        if (!res.ok) return;

        const data = json as SavesListRes;
        setPlan(data.plan);

        const exists = (data.items ?? []).some(
          (it) =>
            it.attempt_type === "fermi" &&
            it.attempt_id === String(lastLogId) &&
            it.save_type === "learning"
        );
        setSaved(exists);
      } catch {
        // ignore
      }
    })();
  }, [lastLogId, isAuthed]);

  /* -------------------------
     保存
  ------------------------- */
  const handleSave = async () => {
    setUiError(null);
    if (!isAuthed) return setUiError("ログインが必要です。");
    if (!lastLogId) return setUiError("先に採点してから保存できます。");
    if (!feedback) return setUiError("保存する内容がありません。");

    try {
      setIsSaving(true);

      const title = `【フェルミ】${question || "Fermi"}`;
      const summary = `合計 ${
        typeof feedback.totalScore === "number" ? feedback.totalScore : "-"
      }点｜${category}/${difficulty}`;

      const payload = {
        input: {
          problem: {
            id: currentProblemId,
            category,
            difficulty,
            title: question,
            formulaHint: formula,
            unit,
            defaultFactors: factors.map((f) => f.name),
          },
          answers: {
            question,
            formula,
            unit,
            factors,
            sanityComment,
            result,
          },
        },
        output: {
          score,
          feedback,
          totalScore: feedback.totalScore,
        },
        eval: {
          score,
          feedback,
          totalScore: feedback.totalScore,
        },
        meta: {
          attemptType: "fermi",
          category,
          difficulty,
          problemId: currentProblemId,
          savedAt: new Date().toISOString(),
          version: 1,
        },
      };

      const res = await fetch("/api/saves/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attemptId: String(lastLogId),
          attemptType: "fermi",
          saveType: "learning",
          enabled: true,
          title,
          summary,
          scoreTotal: typeof feedback.totalScore === "number" ? feedback.totalScore : null,
          payload,
          sourceId: String(lastLogId),
        }),
      });

      const json = (await res.json().catch(() => null)) as ToggleSaveRes | ApiErr | any;

      if (!res.ok) {
        if (res.status === 403) {
          if (json?.error === "upgrade_required" || json?.error === "limit_exceeded") {
            setUpgradeMessage(json?.message ?? "保存にはアップグレードが必要です。");
            setUpgradeOpen(true);
            return;
          }
        }
        setUiError(json?.message ?? "保存に失敗しました。");
        return;
      }

      setPlan(json?.plan ?? plan);
      setSaved(Boolean(json?.enabled));
    } catch (e) {
      console.error(e);
      setUiError("保存に失敗しました。");
    } finally {
      setIsSaving(false);
    }
  };

  /* -------------------------------
     UI：プール操作
  -------------------------------- */
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

  /* -------------------------------
     レイアウト
  -------------------------------- */
  return (
    <>
      <div className="flex h-full gap-6">
        {/* 左カラム */}
        <div className="flex-1 space-y-6 overflow-y-auto pr-2">
          {(authError || uiError) && (
            <div className="rounded-2xl border border-rose-100 bg-rose-50 p-3 text-xs text-rose-700">
              {authError ?? uiError}
            </div>
          )}

          {/* フェルミ問題ガチャ */}
          <section className="mb-2 rounded-2xl border border-sky-100 bg-sky-50/70 p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h1 className="text-sm font-semibold text-sky-900">
                  Fermi Estimation Trainer
                </h1>
                <p className="mt-1 text-[11px] text-sky-700">
                  カテゴリと難易度を選んで「新しい問題セット(50)」を押すと、フェルミ問題が生成されます。
                </p>
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
                  問題プール:{" "}
                  <span className="font-semibold">{problemPool.length || 0}</span>
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
                  disabled={!canPrev}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                    canPrev
                      ? "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      : "cursor-not-allowed bg-slate-100 text-slate-300"
                  }`}
                >
                  ◀︎ 前
                </button>
                <button
                  type="button"
                  onClick={goNext}
                  disabled={!canNext}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                    canNext
                      ? "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      : "cursor-not-allowed bg-slate-100 text-slate-300"
                  }`}
                >
                  次 ▶︎
                </button>

                <button
                  type="button"
                  onClick={generateNewProblem}
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
                <div className="w-full text-[11px] text-slate-500">
                  {currentProblemId ? (
                    <>
                      現在の問題ID：{" "}
                      <span className="font-mono text-slate-700">{currentProblemId}</span>
                    </>
                  ) : (
                    "まずは「新しい問題セット(50)」を押してスタート。"
                  )}
                </div>
              </div>
            </div>

            {/* ✅ プール内ジャンプ */}
            {problemPool.length > 0 && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-[11px] text-slate-600">ジャンプ：</span>
                <select
                  className="w-56 rounded-xl border border-slate-200 bg-white/80 px-2 py-1.5 text-xs"
                  value={poolIndex}
                  onChange={(e) => showPoolIndex(Number(e.target.value))}
                >
                  {problemPool.map((p, i) => (
                    <option key={p.id} value={i}>
                      {String(i + 1).padStart(2, "0")}. {p.title.slice(0, 26)}
                      {p.title.length > 26 ? "…" : ""}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  className="ml-auto rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-600 hover:bg-slate-50"
                  onClick={() => {
                    if (problemPool[poolIndex]) materializeProblem(problemPool[poolIndex]);
                  }}
                >
                  今の問題を初期状態に戻す
                </button>
              </div>
            )}
          </section>

          {/* ① 再定義 */}
          <section className="rounded-2xl border border-slate-200 bg-white/70 p-4 shadow-sm">
            <h2 className="mb-2 text-sm font-semibold text-slate-700">
              ① 問題の再定義（Reframe）
            </h2>
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
                <div
                  key={factor.id}
                  className="rounded-xl border border-slate-100 bg-slate-50/70 p-3"
                >
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
              <h2 className="text-sm font-semibold text-slate-700">④ 計算（Computation）</h2>
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
            <h2 className="mb-2 text-sm font-semibold text-slate-700">
              ⑤ オーダーチェック（Sanity Check）
            </h2>
            <textarea
              className="w-full rounded-xl border border-slate-200 bg-white/80 p-2 text-sm"
              rows={3}
              placeholder="例：スタバ売上や飲食市場と比較して 1〜2桁以内なので妥当。"
              value={sanityComment}
              onChange={(e) => setSanityComment(e.target.value)}
            />
          </section>

          {/* ✅ 評価 + 保存 */}
          <section className="mb-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={handleEvaluate}
              disabled={isEvaluating}
              className={`rounded-full px-5 py-2 text-xs font-semibold text-white ${
                isEvaluating
                  ? "cursor-not-allowed bg-slate-300"
                  : "bg-violet-500 hover:bg-violet-600"
              }`}
            >
              {isEvaluating ? "AIが採点中…" : "AIに採点してもらう"}
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={!feedback || isSaving || saved}
              className={`rounded-full px-4 py-2 text-xs font-semibold ${
                !feedback || isSaving || saved
                  ? "cursor-not-allowed bg-slate-100 text-slate-400"
                  : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              {saved ? "保存済み" : isSaving ? "保存中…" : "保存（あとで見返す）"}
            </button>
          </section>

          {/* フィードバック */}
          {feedback && (
            <section className="mb-8 rounded-2xl border border-violet-100 bg-violet-50/60 p-4 shadow-sm">
              <h3 className="mb-2 text-xs font-semibold text-violet-700">
                フィードバック & 模範回答イメージ
              </h3>

              <p className="mb-3 text-xs text-slate-700">{feedback.summary}</p>

              <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-slate-100 bg-white/80 p-3">
                  <p className="mb-1 text-[11px] font-semibold text-emerald-600">
                    👍 良いポイント
                  </p>
                  <ul className="list-disc space-y-1 pl-4 text-[11px] text-slate-700">
                    {(feedback.strengths ?? []).map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-xl border border-slate-100 bg-white/80 p-3">
                  <p className="mb-1 text-[11px] font-semibold text-rose-600">
                    ⚠ 改善ポイント
                  </p>
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
                <pre className="whitespace-pre-wrap text-[11px] text-slate-700">
                  {feedback.sampleAnswer}
                </pre>
              </div>
            </section>
          )}
        </div>

        {/* 右カラム：スコア */}
        <aside className="w-64 shrink-0 space-y-4">
          <div className="rounded-2xl border border-sky-100 bg-sky-50/70 p-4 shadow-sm">
            <h3 className="mb-2 text-xs font-semibold tracking-wide text-sky-700">
              型スコア（Fermi Pattern）
            </h3>
            <ul className="space-y-1.5 text-xs text-slate-700">
              <li className="flex justify-between">
                <span>再定義</span>
                <span className="font-semibold">{score.reframing}</span>
              </li>
              <li className="flex justify-between">
                <span>要素分解</span>
                <span className="font-semibold">{score.decomposition}</span>
              </li>
              <li className="flex justify-between">
                <span>仮定の質</span>
                <span className="font-semibold">{score.assumptions}</span>
              </li>
              <li className="flex justify-between">
                <span>数字感</span>
                <span className="font-semibold">{score.numbersSense}</span>
              </li>
              <li className="flex justify-between">
                <span>オーダー感</span>
                <span className="font-semibold">{score.sanityCheck}</span>
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

      {/* ✅ META確認モーダル（固定仕様） */}
      <MetaConfirmModal
        open={metaConfirmOpen}
        onClose={() => {
          setMetaConfirmOpen(false);
          pendingEvalKeyRef.current = null;
          pendingGenKeyRef.current = null;
        }}
        onConfirm={handleMetaConfirm}
        featureLabel={
          pendingGenKeyRef.current ? "フェルミ推定AI（問題生成）" : "フェルミ推定AI（採点）"
        }
        cost={metaCost}
        balance={metaBalance}
      />

      {/* 既存：サブスク誘導モーダル（残す） */}
      <UpgradeModal
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        message={upgradeMessage}
        featureLabel="フェルミ推定AI"
      />
    </>
  );
};
