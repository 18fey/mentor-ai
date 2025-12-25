// src/components/CaseInterviewAI.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { MetaConfirmModal } from "@/components/MetaConfirmModal";

/* ============================
   型定義
============================ */
type CaseDomain = "consulting" | "general" | "trading" | "ib";
type CasePattern =
  | "market_sizing"
  | "profitability"
  | "entry"
  | "new_business"
  | "operation";

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

type Plan = "free" | "pro" | "elite";

type GenerateRes = {
  ok: true;
  plan: Plan;
  remaining?: number;
  case: CaseQuestion;
};

type EvalRes = {
  ok: true;
  plan: Plan;
  score: CaseScore;
  feedback: CaseFeedback;
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

type ApiErr = {
  error?: string;
  code?: string;
  message?: string;
  reason?: string;
  required?: number;
  balance?: number;
};

type MetaBalanceRes =
  | { ok: true; balance: number }
  | { ok: false; status: number; reason?: string; message?: string };

/* ============================
   constants
============================ */
const FEATURE_LABEL = "ケース面接AI";
const FEATURE_REQUIRED_META = 2; // ✅ featureGate.ts の case_interview のコストと合わせる

function isUnlimited(plan: Plan) {
  return plan === "pro" || plan === "elite";
}

/* ============================
   メインコンポーネント
============================ */
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
  const [isAuthed, setIsAuthed] = useState<boolean>(false);
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

  // 保存
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // ✅ MetaConfirmModal
  const [metaModalOpen, setMetaModalOpen] = useState(false);
  const [metaBalance, setMetaBalance] = useState<number | null>(null);
  const [metaNeed, setMetaNeed] = useState<number>(FEATURE_REQUIRED_META);
  const [metaMode, setMetaMode] = useState<"confirm" | "purchase">("confirm");
  const [metaTitle, setMetaTitle] = useState<string | undefined>(undefined);
  const [metaMessage, setMetaMessage] = useState<string | undefined>(undefined);
  const [pendingAction, setPendingAction] = useState<null | (() => Promise<void>)>(
    null
  );

  const closeMetaModal = () => {
    setMetaModalOpen(false);
    setMetaTitle(undefined);
    setMetaMessage(undefined);
    setPendingAction(null);
  };

  // ✅ 残高取得（APIがある前提：/api/meta/balance）
  const fetchMyBalance = async (): Promise<number | null> => {
    try {
      const res = await fetch("/api/meta/balance", { method: "POST" });
      const json = (await res.json().catch(() => null)) as MetaBalanceRes | null;
      if (!res.ok || !json || (json as any).ok !== true) return null;
      return Number((json as any).balance ?? 0);
    } catch {
      return null;
    }
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

      // ✅ ログインできたら残高も一回取っておく
      const b = await fetchMyBalance();
      if (typeof b === "number") setMetaBalance(b);
    })();
  }, [supabase]);

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
    setSaved(false);
  };

  /* -------------------------
     ケース生成（API）
  ------------------------- */
  const handleGenerateCase = async () => {
    setUiError(null);
    if (!isAuthed) {
      setUiError("ログインが必要です。");
      return;
    }

    try {
      setIsGenerating(true);

      const res = await fetch("/api/case/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain, pattern }),
      });

      const json = (await res.json().catch(() => null)) as GenerateRes | ApiErr | null;

      if (!res.ok) {
        setUiError((json as ApiErr | null)?.message ?? "ケース生成に失敗しました。");
        return;
      }

      const data = json as GenerateRes;
      setPlan(data.plan);
      if (typeof data.remaining === "number") setRemaining(data.remaining);
      setCurrentCase(data.case);
      resetAnswers();
    } catch (e) {
      console.error(e);
      setUiError("通信エラーが発生しました。時間をおいて再度お試しください。");
    } finally {
      setIsGenerating(false);
    }
  };

  /* -------------------------
     AI評価（内部：実行本体）
  ------------------------- */
  const doEvaluate = async () => {
    if (!currentCase) return;

    const res = await fetch("/api/eval/case", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
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
      }),
    });

    const json = (await res.json().catch(() => null)) as EvalRes | ApiErr | null;

    if (!res.ok) {
      // ✅ 新featureGate側：META不足（402）
      if (res.status === 402) {
        const required = Number((json as any)?.required ?? FEATURE_REQUIRED_META);
        const b =
          typeof (json as any)?.balance === "number"
            ? Number((json as any).balance)
            : await fetchMyBalance();

        setMetaNeed(required);
        setMetaBalance(typeof b === "number" ? b : null);
        setMetaMode("purchase");
        setMetaTitle("METAが不足しています");
        setMetaMessage(
          `この実行には META が ${required} 必要です。購入して続行してください。`
        );
        setMetaModalOpen(true);
        return;
      }

      // ✅ 旧仕様：403 limit_exceeded（残してある場合）
      if (res.status === 403 && (json as any)?.error === "limit_exceeded") {
        setMetaMode("purchase");
        setMetaTitle("無料枠終了");
        setMetaMessage(
          (json as any)?.message ?? "今月の無料利用回数が上限に達しました。"
        );
        setMetaNeed(FEATURE_REQUIRED_META);
        setMetaModalOpen(true);
        return;
      }

      if (res.status === 401) {
        setUiError("ログインが必要です。いったんログインし直してください。");
        return;
      }

      setUiError((json as ApiErr | null)?.message ?? "評価に失敗しました。");
      return;
    }

    const data = json as EvalRes;
    setPlan(data.plan);
    setScore(data.score);
    setFeedback(data.feedback);
    setTotalScore(typeof data.totalScore === "number" ? data.totalScore : null);
    setLastLogId(data.logId ?? null);
    setSaved(false);

    // ✅ 評価が終わったら残高も更新（freeのときだけ）
    if (!isUnlimited(data.plan)) {
      const b = await fetchMyBalance();
      if (typeof b === "number") setMetaBalance(b);
    }
  };

  /* -------------------------
     AI評価（クリックハンドラ）
     - free: 事前にモーダルで確認（confirm/purchase分岐）
     - pro/elite: 直で実行
  ------------------------- */
  const handleEvaluate = async () => {
    setUiError(null);
    if (!currentCase) return;
    if (!isAuthed) return setUiError("ログインが必要です。");

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

    if (totalLen < 80) return setUiError("もう少し書いてから評価してみて！目安：合計80文字以上。");

    // ✅ Pro/Eliteは素通り
    if (isUnlimited(plan)) {
      try {
        setIsEvaluating(true);
        await doEvaluate();
      } catch (e) {
        console.error(e);
        setUiError("通信エラーが発生しました。時間をおいて再度お試しください。");
      } finally {
        setIsEvaluating(false);
      }
      return;
    }

    // ✅ Freeは「事前確認」：残高を取り、confirm/purchaseを自動判定
    try {
      setIsEvaluating(true);

      const b = await fetchMyBalance();
      const balance = typeof b === "number" ? b : metaBalance;

      setMetaNeed(FEATURE_REQUIRED_META);
      setMetaBalance(typeof balance === "number" ? balance : null);

      const m =
        typeof balance === "number" && balance < FEATURE_REQUIRED_META
          ? "purchase"
          : "confirm";

      setMetaMode(m);
      setMetaTitle(undefined);
      setMetaMessage(undefined);

      // ✅ confirm押下後に実行する関数をセット
      setPendingAction(async () => {
        try {
          await doEvaluate();
        } finally {
          // doEvaluate側で不足ならpurchaseモードで再表示される
        }
      });

      setMetaModalOpen(true);
    } catch (e) {
      console.error(e);
      setUiError("通信エラーが発生しました。時間をおいて再度お試しください。");
    } finally {
      setIsEvaluating(false);
    }
  };

  /* -------------------------
     保存状態チェック（評価が来たら）
  ------------------------- */
  useEffect(() => {
    if (!lastLogId) return;
    if (!isAuthed) return;

    (async () => {
      try {
        const res = await fetch("/api/saves/list", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ attemptType: "case", saveType: "learning", limit: 100 }),
        });

        const json = (await res.json().catch(() => null)) as SavesListRes | ApiErr | null;
        if (!res.ok) return;

        const data = json as SavesListRes;
        setPlan(data.plan);

        const exists = (data.items ?? []).some(
          (it) =>
            it.attempt_type === "case" &&
            it.attempt_id === String(lastLogId) &&
            it.save_type === "learning"
        );
        setSaved(exists);
      } catch {
        // 無視
      }
    })();
  }, [lastLogId, isAuthed]);

  /* -------------------------
     保存（API経由に統一）
  ------------------------- */
  const handleSave = async () => {
    setUiError(null);
    if (!isAuthed) return setUiError("ログインが必要です。");
    if (!lastLogId) return setUiError("先に評価してから保存できます。");
    if (!currentCase || !feedback) return setUiError("保存する内容がありません。");

    try {
      setIsSaving(true);

      const title = `【ケース】${currentCase.client} / ${currentCase.title}`;
      const summary = `合計 ${typeof totalScore === "number" ? totalScore : "-"}点｜${domain}/${pattern}`;

      const payload = {
        input: {
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
        },
        output: { score, feedback, totalScore },
        eval: { score, feedback, totalScore },
        meta: {
          attemptType: "case",
          domain,
          pattern,
          caseId: currentCase.id,
          savedAt: new Date().toISOString(),
          version: 1,
        },
      };

      const res = await fetch("/api/saves/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attemptId: String(lastLogId),
          attemptType: "case",
          saveType: "learning",
          enabled: true,
          title,
          summary,
          scoreTotal: typeof totalScore === "number" ? totalScore : null,
          payload,
          sourceId: String(lastLogId),
        }),
      });

      const json = (await res.json().catch(() => null)) as any;

      if (!res.ok) {
        // ✅ 保存は「PROが必要」系が多いので purchase モーダルに寄せる
        if (res.status === 403 && (json?.error === "upgrade_required" || json?.error === "limit_exceeded")) {
          setMetaMode("purchase");
          setMetaTitle("PROが必要です");
          setMetaMessage(json?.message ?? "保存機能の利用にはPROが必要です。");
          setMetaNeed(0);
          setMetaModalOpen(true);
          return;
        }

        setUiError(json?.message ?? "保存に失敗しました。");
        return;
      }

      setPlan(json.plan);
      setSaved(Boolean(json.enabled));
    } catch (e) {
      console.error(e);
      setUiError("保存に失敗しました。");
    } finally {
      setIsSaving(false);
    }
  };

  /* -------------------------
     レイアウト
  ------------------------- */
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
                <h1 className="text-sm font-semibold text-sky-900">
                  Case Interview Trainer
                </h1>
                <p className="mt-1 text-[11px] text-sky-700">
                  業界とケース種別を選んで「新しいケースを出す」を押すと、ケース問題が生成されます。
                </p>
                <p className="mt-1 text-[11px] text-sky-700">
                  Plan: <span className="font-semibold">{plan}</span>
                  {typeof remaining === "number" && (
                    <>
                      {" "}
                      / 今月残り:{" "}
                      <span className="font-semibold">{remaining}</span>
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
                  isGenerating
                    ? "cursor-not-allowed bg-slate-300"
                    : "bg-sky-500 hover:bg-sky-600"
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
                      現在のケースID:{" "}
                      <span className="font-mono">{currentCase.id}</span>
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

          {/* 評価 + 保存 */}
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
              {isEvaluating ? "準備中…" : "AIに評価してもらう"}
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
          const fn = pendingAction;
          closeMetaModal();
          if (!fn) return;
          try {
            setIsEvaluating(true);
            await fn();
          } catch (e) {
            console.error(e);
            setUiError("通信エラーが発生しました。時間をおいて再度お試しください。");
          } finally {
            setIsEvaluating(false);
          }
        }}
        onPurchase={() => router.push("/pricing")}
      />
    </>
  );
};
