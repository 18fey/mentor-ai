// app/general/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { StatCard } from "@/components/StatCard";
import { InterviewRecorder } from "@/components/InterviewRecorder";
import { MetaConfirmModal } from "@/components/MetaConfirmModal";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import type { TopicType } from "@/lib/types/story";

/**
 * ✅ 方針（CaseInterviewAI と同じ形に寄せる）
 * - 「開始」は消費しない（usage/check で開始可否だけ確認し、OKなら即開始）
 * - 「評価」完了時だけ消費（/api/interview-eval が job化 + 成功後消費）
 * - MetaConfirmModal は 1つだけ（評価APIで 402 need_meta のときだけ出す）
 * - UI：localStorage で last_job / draft を保持して復帰
 * - エラー時：復帰ボタン / 再実行ボタン（ジョブ方式）
 * - persona/topic 変更：混線防止で last_job / draft を削除
 */

type QA = { question: string; answer: string };

type EvaluationResult = {
  total_score: number;
  star_score: number;
  content_depth_score: number;
  clarity_score: number;
  delivery_score: number;
  auto_feedback?: {
    good_points?: string[];
    improvement_points?: string[];
    one_sentence_advice?: string;
  };
};

type Profile = {
  id: string;
  name?: string;
  university?: string;
  faculty?: string;
  grade?: string;
  interested_industries?: string[];
  values_tags?: string[];
};

const MAX_Q = 10 as const;

// ✅ featureGate.ts の interview_10 と “必ず一致”
const FEATURE_ID = "interview_10";
const FEATURE_LABEL = "一般面接AI（音声版）";
const EVAL_REQUIRED_META = 2;

// localStorage keys（UI仕様）
const LS_LAST_JOB = `last_job:${FEATURE_ID}` as const;
const LS_DRAFT = `draft:${FEATURE_ID}` as const;

const PERSONAS = [
  { id: "consulting_finance", label: "コンサル・外銀系" },
  { id: "sales_trading_commerce", label: "商社・営業・流通系" },
  { id: "finance_banking_insurance", label: "金融（銀行・証券・保険）系" },
  { id: "maker_it_telecom", label: "メーカー・IT・通信系" },
  { id: "service_education_entertainment", label: "サービス・教育・エンタメ系" },
] as const;

const TOPIC_LABEL: Record<TopicType, string> = {
  gakuchika: "ガクチカ（学生時代に力を入れたこと）",
  self_pr: "自己PR",
  why_company: "志望動機（企業）",
  why_industry: "志望動機（業界）",
  general: "一般面接",
};

type Step = "idle" | "asking" | "thinking" | "editing" | "evaluating" | "finished";

/** /api/usage/check の返却に合わせる */
type ProceedMode = "unlimited" | "free" | "need_meta";
type UsageCheckOK = { ok: true; mode: ProceedMode; requiredMeta?: number; balance?: number };
type UsageCheckNeedMeta = { ok: false; error: "need_meta"; requiredMeta: number; balance?: number };

function buildQuestions(profile: Profile | null): string[] {
  const hasProfile = !!profile;
  const name = profile?.name || "あなた";
  const uni = profile?.university || "大学";
  const faculty = profile?.faculty || "";
  const grade = profile?.grade || "";
  const mainIndustry = profile?.interested_industries?.[0];

  const baseIntro = hasProfile
    ? `まずは ${name} さんの簡単な自己紹介をお願いします。（${uni}${faculty ? ` / ${faculty}` : ""}${
        grade ? ` / ${grade}年` : ""
      } などを含めて）`
    : "それでは模擬面接を始めます。まずは簡単な自己紹介をお願いします。";

  const baseGakuchika = hasProfile
    ? `${uni} での学生生活の中で、特に力を入れた取り組みを教えてください。`
    : "学生時代に最も力を入れた取り組みを教えてください。";

  const industryTail = mainIndustry ? `（特に ${mainIndustry} を志望している前提で考えてみてください）` : "";

  return [
    baseIntro,
    baseGakuchika,
    "その中で直面した最大の課題（困難）は何でしたか？",
    "その課題に対して、あなたが取った具体的な行動を教えてください。",
    "その行動の結果として、状況はどのように変化しましたか？",
    "この経験から得た学びを一言で言うと何ですか？",
    "周囲のメンバーからはどのように評価されましたか？",
    `今振り返って「ここはもっと改善できたな」と思う点はありますか？${industryTail}`,
    "あなたらしさが最も現れている部分はどこですか？",
    "最後に、この経験を通じて言える“あなたの強み”は何ですか？",
  ];
}

async function fetchMyMetaBalance(): Promise<number | null> {
  try {
    const res = await fetch("/api/meta/balance", { method: "GET" });
    const data = await res.json().catch(() => null);
    if (!res.ok) return null;
    if (!data?.ok) return null;
    const b = Number(data?.balance ?? 0);
    return Number.isFinite(b) ? b : null;
  } catch {
    return null;
  }
}

/**
 * ✅ 開始時のチェック（消費はしない）
 * - 「開始」は通してOK（評価時に消費）
 * - ただし free枠/権限などの “開始可否” は usage/check を信じる
 */
async function callUsageCheckClient(): Promise<
  | { ok: true; mode: ProceedMode; requiredMeta: number; balance: number | null }
  | { ok: false; status: number; requiredMeta: number; balance: number | null; reason?: string }
> {
  try {
    const res = await fetch("/api/usage/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        feature: FEATURE_ID,
        requiredMeta: EVAL_REQUIRED_META,
      }),
    });

    const data = (await res.json().catch(() => ({}))) as Partial<UsageCheckOK | UsageCheckNeedMeta>;

    // need_meta は「評価時に必要」なので開始は許可してよい（ただしここでは情報として返す）
    if (res.status === 402 || (data as any)?.error === "need_meta") {
      const requiredMeta =
        Number((data as any)?.requiredMeta ?? (data as any)?.required ?? EVAL_REQUIRED_META) || EVAL_REQUIRED_META;
      const balance = Number.isFinite(Number((data as any)?.balance)) ? Number((data as any)?.balance) : null;
      return { ok: false, status: 402, requiredMeta, balance, reason: "need_meta" };
    }

    if (!res.ok) {
      const requiredMeta =
        Number((data as any)?.requiredMeta ?? (data as any)?.required ?? EVAL_REQUIRED_META) || EVAL_REQUIRED_META;
      const balance = Number.isFinite(Number((data as any)?.balance)) ? Number((data as any)?.balance) : null;
      return { ok: false, status: res.status || 500, requiredMeta, balance, reason: "server_error" };
    }

    const mode = ((data as any)?.mode as ProceedMode) || "free";
    const requiredMeta =
      Number((data as any)?.requiredMeta ?? (data as any)?.required ?? EVAL_REQUIRED_META) || EVAL_REQUIRED_META;
    const balance = Number.isFinite(Number((data as any)?.balance)) ? Number((data as any)?.balance) : null;

    return { ok: true, mode, requiredMeta, balance };
  } catch (e) {
    console.error("callUsageCheckClient failed:", e);
    return { ok: false, status: 500, requiredMeta: EVAL_REQUIRED_META, balance: null, reason: "network_error" };
  }
}

function safeJsonParse<T>(s: string | null): T | null {
  if (!s) return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

function nowIso() {
  return new Date().toISOString();
}

function newIdempotencyKey(): string {
  const g = (globalThis as any)?.crypto?.randomUUID?.();
  if (typeof g === "string" && g.length > 10) return g;
  return `${Date.now()}_${Math.random().toString(16).slice(2)}_${Math.random().toString(16).slice(2)}`;
}

type LastJobLS = { key: string; createdAt: string };
type DraftLS = {
  personaId: string;
  topicType: TopicType;
  step: Step;
  qaList: QA[];
  currentIdx: number;
  currentQuestion: string;
  pendingTranscript: string;
  updatedAt: string;
  evalIdempotencyKey?: string | null;
};

type JobStatusResponse = {
  ok: boolean;
  job?: {
    id?: string | null;
    status: "queued" | "running" | "succeeded" | "failed";
    request?: any;
    result?: any;
    error_code?: string | null;
    error_message?: string | null;
  };
  error?: string;
};

export default function InterviewPage() {
  const router = useRouter();

  const supabase = useMemo(
    () =>
      createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!),
    []
  );

  const [userId, setUserId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const stats = [
    { label: "模擬面接回数", value: "—", helper: "これまでのセッション数（あなた専用）" },
    { label: "平均評価", value: "—", helper: "5点満点の平均レビュー（あなた専用）" },
    { label: "累計練習時間", value: "—", helper: "ケース以外の面接練習時間（あなた専用）" },
  ];

  const [personaId, setPersonaId] = useState<string>("consulting_finance");
  const [topicType, setTopicType] = useState<TopicType>("gakuchika");

  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);

  const [step, setStep] = useState<Step>("idle");
  const [qaList, setQAList] = useState<QA[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [pendingTranscript, setPendingTranscript] = useState<string>("");
  const [isCommitting, setIsCommitting] = useState(false);

  const [isCreatingCard, setIsCreatingCard] = useState(false);
  const [createMessage, setCreateMessage] = useState<string | null>(null);

  // ✅ 402 need_meta の表示（評価で必要になった時）
  const [needMeta, setNeedMeta] = useState<number | null>(null);

  // ✅ 「開始時」チェック情報（表示だけ・開始は通す）
  const [startNotice, setStartNotice] = useState<string | null>(null);

  // ✅ 評価ジョブ key
  const evalIdempotencyKeyRef = useRef<string | null>(null);

  const logRef = useRef<HTMLDivElement | null>(null);

  // ✅ MetaConfirmModal（評価だけで使う / 1個だけ）
  const [metaModalOpen, setMetaModalOpen] = useState(false);
  const [metaBalance, setMetaBalance] = useState<number | null>(null);
  const [metaNeed, setMetaNeed] = useState<number>(EVAL_REQUIRED_META);
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

  const openMetaModalFor = async (params: { requiredMeta: number; onProceed: () => Promise<void> }) => {
    const { requiredMeta, onProceed } = params;

    const b = await fetchMyMetaBalance();
    setMetaNeed(requiredMeta);
    setMetaBalance(typeof b === "number" ? b : null);

    const mode: "confirm" | "purchase" = typeof b === "number" && b < requiredMeta ? "purchase" : "confirm";
    setMetaMode(mode);

    setMetaTitle(mode === "purchase" ? "METAが不足しています" : "METAの確認");
    setMetaMessage(
      mode === "purchase"
        ? `この評価を実行するには META が ${requiredMeta} 必要です。購入して続行してください。`
        : `この評価の実行には META を ${requiredMeta} 消費します。続行しますか？`
    );

    setPendingAction(() => async () => {
      await onProceed();
      const bb = await fetchMyMetaBalance();
      if (typeof bb === "number") setMetaBalance(bb);
    });

    setMetaModalOpen(true);
  };

  // ------------------------------
  // localStorage helpers
  // ------------------------------
  const clearLastJob = () => {
    try {
      localStorage.removeItem(LS_LAST_JOB);
    } catch {}
  };
  const saveLastJob = (key: string) => {
    const v: LastJobLS = { key, createdAt: nowIso() };
    try {
      localStorage.setItem(LS_LAST_JOB, JSON.stringify(v));
    } catch {}
  };
  const loadLastJob = (): LastJobLS | null => {
    try {
      return safeJsonParse<LastJobLS>(localStorage.getItem(LS_LAST_JOB));
    } catch {
      return null;
    }
  };

  // ✅ 評価を「再実行」するために、ジョブ紐づけを捨てて新規評価にする
  const resetEvaluationJob = () => {
    clearLastJob();
    evalIdempotencyKeyRef.current = null;
    setEvaluation(null);
    setNeedMeta(null);
  };

  const clearDraft = () => {
    try {
      localStorage.removeItem(LS_DRAFT);
    } catch {}
  };
  const loadDraft = (): DraftLS | null => {
    try {
      return safeJsonParse<DraftLS>(localStorage.getItem(LS_DRAFT));
    } catch {
      return null;
    }
  };
  const saveDraft = (d: DraftLS) => {
    try {
      localStorage.setItem(LS_DRAFT, JSON.stringify(d));
    } catch {}
  };

  // 入力条件が変わる操作：last_job + draft を削除（混線防止）
  const resetPersistenceForInputChange = () => {
    clearLastJob();
    clearDraft();
    evalIdempotencyKeyRef.current = null;
    setEvaluation(null);
    setError(null);
    setNeedMeta(null);
    setStartNotice(null);
  };

  // ------------------------------
  // auth & profile
  // ------------------------------
  useEffect(() => {
    const run = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          router.push("/auth");
          return;
        }
        setUserId(user.id);

        const res = await fetch(`/api/profile/get?userId=${encodeURIComponent(user.id)}`);
        const data = await res.json().catch(() => ({}));
        if (data.profile) setProfile(data.profile);
      } catch (e) {
        console.error("Failed to fetch auth/profile:", e);
      } finally {
        setProfileLoaded(true);
        setAuthChecked(true);
      }
    };
    run();
  }, [supabase, router]);

  const questions = useMemo(() => buildQuestions(profile), [profileLoaded, profile]);

  const scrollToBottom = () => {
    setTimeout(() => {
      if (logRef.current) {
        logRef.current.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
      }
    }, 120);
  };

  // ------------------------------
  // Draft persistence
  // ------------------------------
  const draftSaveTimer = useRef<number | null>(null);
  useEffect(() => {
    if (!authChecked) return;

    const isTrivialIdle =
      step === "idle" && qaList.length === 0 && !pendingTranscript && !evaluation && currentIdx === 0;

    if (isTrivialIdle) return;

    if (draftSaveTimer.current) {
      window.clearTimeout(draftSaveTimer.current);
      draftSaveTimer.current = null;
    }

    draftSaveTimer.current = window.setTimeout(() => {
      const d: DraftLS = {
        personaId,
        topicType,
        step,
        qaList,
        currentIdx,
        currentQuestion,
        pendingTranscript,
        updatedAt: nowIso(),
        evalIdempotencyKey: evalIdempotencyKeyRef.current,
      };
      saveDraft(d);
    }, 180);

    return () => {
      if (draftSaveTimer.current) {
        window.clearTimeout(draftSaveTimer.current);
        draftSaveTimer.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authChecked, personaId, topicType, step, qaList, currentIdx, currentQuestion, pendingTranscript, evaluation]);

  // 起動時：draft 復元
  useEffect(() => {
    if (!authChecked) return;

    const d = loadDraft();
    if (!d) return;

    if (!d.personaId || !d.topicType) {
      clearDraft();
      return;
    }

    setPersonaId(d.personaId);
    setTopicType(d.topicType);

    setStep(d.step);
    setQAList(Array.isArray(d.qaList) ? d.qaList : []);
    setCurrentIdx(Number.isFinite(d.currentIdx as any) ? d.currentIdx : 0);
    setCurrentQuestion(typeof d.currentQuestion === "string" ? d.currentQuestion : "");
    setPendingTranscript(typeof d.pendingTranscript === "string" ? d.pendingTranscript : "");

    if (typeof d.evalIdempotencyKey === "string" && d.evalIdempotencyKey.length > 5) {
      evalIdempotencyKeyRef.current = d.evalIdempotencyKey;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authChecked]);

  // ------------------------------
  // generation_jobs status復帰
  // ------------------------------
  const fetchJobStatus = async (key: string): Promise<JobStatusResponse> => {
    const qs = new URLSearchParams({ feature: FEATURE_ID, key });
    const res = await fetch(`/api/generation-jobs/status?${qs.toString()}`, { method: "GET" });
    const data = (await res.json().catch(() => null)) as JobStatusResponse | null;
    if (!data) return { ok: false, error: "bad_response" };
    return data;
  };

  const pollJobUntilDone = async (key: string) => {
    const maxTries = 24;
    const sleepMs = 1100;

    for (let i = 0; i < maxTries; i++) {
      const st = await fetchJobStatus(key);
      if (st.ok && st.job) {
        if (st.job.status === "succeeded") {
          const r = st.job.result as EvaluationResult | undefined;
          if (r) setEvaluation(r);

          const req = st.job.request;
          if (req?.qaList && Array.isArray(req.qaList) && req.qaList.length) {
            setQAList(req.qaList);
          }

          setStep("finished");
          setError(null);
          setNeedMeta(null);
          scrollToBottom();
          return;
        }
        if (st.job.status === "failed") {
          setStep("finished");
          setError(st.job.error_message || "評価ジョブが失敗しました。時間をおいて再度お試しください。");
          scrollToBottom();
          return;
        }
        setStep("evaluating");
      }
      await new Promise((r) => setTimeout(r, sleepMs));
    }

    setError("評価の作成に時間がかかっています。しばらくしてから再読み込みしてください（復帰できます）。");
    setStep("evaluating");
  };

  useEffect(() => {
    if (!authChecked) return;

    const lj = loadLastJob();
    if (!lj?.key) return;

    (async () => {
      const st = await fetchJobStatus(lj.key);

      if (!st.ok || !st.job) {
        clearLastJob();
        return;
      }

      if (st.job.status === "succeeded") {
        const r = st.job.result as EvaluationResult | undefined;
        if (r) setEvaluation(r);

        const req = st.job.request;
        if (req?.qaList && Array.isArray(req.qaList) && req.qaList.length) {
          setQAList(req.qaList);
        }

        setStep("finished");
        setError(null);
        setNeedMeta(null);
        scrollToBottom();
        return;
      }

      if (st.job.status === "failed") {
        setStep("finished");
        setError(st.job.error_message || "評価ジョブが失敗しました。");
        scrollToBottom();
        return;
      }

      setStep("evaluating");
      await pollJobUntilDone(lj.key);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authChecked]);

  // ------------------------------
  // 面接の開始（消費しない / モーダル無し）
  // ------------------------------
  const startInterviewCore = () => {
    resetPersistenceForInputChange();

    setQAList([]);
    setEvaluation(null);
    setCurrentIdx(0);
    setCurrentQuestion(questions[0]);
    setStep("asking");
    setError(null);
    setNeedMeta(null);
    setCreateMessage(null);
    setPendingTranscript("");
    setIsCommitting(false);
    scrollToBottom();
  };

  const startInterview = async () => {
    if (!authChecked || !userId) {
      router.push("/auth");
      return;
    }
    if (step !== "idle" && step !== "finished") return;

    setError(null);
    setNeedMeta(null);
    setStartNotice(null);

    const check = await callUsageCheckClient();

    // ✅ usage/check が死んでる：開始は止める（安全側）
    if (!check.ok && check.status !== 402) {
      setError("回数確認に失敗しました。通信環境を確認して、もう一度お試しください。");
      return;
    }

    // ✅ need_meta でも「開始」は通す（評価時にだけ必要）
    if (!check.ok && check.status === 402) {
      setStartNotice(`この面接は開始できます。評価を実行するには META が ${check.requiredMeta} 必要です。`);
    }

    startInterviewCore();
  };

  // ------------------------------
  // 評価（ジョブ方式）
  // ------------------------------
  const runEvaluation = async (finishedList: QA[], opts?: { metaConfirm?: boolean }) => {
    try {
      setStep("evaluating");
      setError(null);
      setNeedMeta(null);
      scrollToBottom();

      const topicLabel = TOPIC_LABEL[topicType] || "一般面接";

      let key = evalIdempotencyKeyRef.current;
      if (!key) {
        key = newIdempotencyKey();
        evalIdempotencyKeyRef.current = key;
      }
      saveLastJob(key);

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-Idempotency-Key": key,
      };
      if (opts?.metaConfirm) headers["X-Meta-Confirm"] = "1";

      const res = await fetch("/api/interview-eval", {
        method: "POST",
        headers,
        body: JSON.stringify({
          idempotencyKey: key,
          featureId: FEATURE_ID,
          persona_id: personaId,
          qaList: finishedList,
          topic: topicLabel,
          is_sensitive: false,
        }),
      });

      // ✅ need_meta → モーダル1つで confirm/purchase を出し分け
      if (res.status === 402) {
        const data = await res.json().catch(() => ({}));
        const required =
          Number((data as any)?.requiredMeta ?? (data as any)?.required ?? EVAL_REQUIRED_META) || EVAL_REQUIRED_META;

        setNeedMeta(required);

        await openMetaModalFor({
          requiredMeta: required,
          onProceed: async () => {
            // confirm したら同じ key で metaConfirm 再実行
            closeMetaModal();
            await runEvaluation(finishedList, { metaConfirm: true });
          },
        });

        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message || data?.error || "面接評価APIでエラーが発生しました。");
      }

      const data = (await res.json().catch(() => null)) as any;

      if (!data?.ok) {
        throw new Error(data?.message || data?.error || "面接評価の取得に失敗しました。");
      }

      // 直返し（succeeded）
      const direct: EvaluationResult | null =
        (data?.total_score != null ? (data as EvaluationResult) : null) ||
        (data?.result ? (data.result as EvaluationResult) : null);

      if (direct) {
        setEvaluation(direct);
        setStep("finished");
        scrollToBottom();
        return;
      }

      // ジョブが走ってるならポーリング
      const status = data?.status as string | undefined;
      if (status === "running" || status === "queued") {
        setStep("evaluating");
        await pollJobUntilDone(key);
        return;
      }

      await pollJobUntilDone(key);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "面接評価の作成中にエラーが発生しました。通信環境を確認して再度お試しください。");
      setStep("finished");
      scrollToBottom();
    }
  };

  // ------------------------------
  // 音声文字起こし〜確定
  // ------------------------------
  const handleRecorded = async (blob: Blob) => {
    try {
      setStep("thinking");
      setError(null);
      scrollToBottom();

      const fd = new FormData();
      fd.append("audio", blob);

      const res = await fetch("/api/transcribe", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.message || "文字起こしに失敗しました。");
      }

      const transcript: string =
        String(data?.transcript ?? "").trim() ||
        "（文字起こしに失敗しました。必要なら編集して確定してください。）";

      setPendingTranscript(transcript);
      setStep("editing");
      scrollToBottom();
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "文字起こし中にエラーが発生しました。通信環境を確認して、もう一度お試しください。");
      setStep("asking");
    }
  };

  const commitEditedTranscript = async () => {
    if (isCommitting) return;
    setIsCommitting(true);
    setError(null);

    try {
      const answer = pendingTranscript.trim() || "（空の回答）";

      const newQA: QA = { question: currentQuestion, answer };
      const nextList = [...qaList, newQA];
      setQAList(nextList);

      setPendingTranscript("");

      const nextIdx = currentIdx + 1;

      if (nextIdx >= MAX_Q) {
        await runEvaluation(nextList);
        return;
      }

      setCurrentIdx(nextIdx);
      setCurrentQuestion(questions[nextIdx]);
      setStep("asking");
      scrollToBottom();
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "確定処理中にエラーが発生しました。");
      setStep("editing");
    } finally {
      setIsCommitting(false);
    }
  };

  const retryAnswer = () => {
    setPendingTranscript("");
    setError(null);
    setStep("asking");
    scrollToBottom();
  };

  // ------------------------------
  // ストーリーカード作成（既存）
  // ------------------------------
  const createStoryCardFromSession = async () => {
    if (!userId) {
      router.push("/auth");
      return;
    }

    if (!evaluation) {
      setCreateMessage("まず10問すべて回答して、面接評価を出してください。");
      return;
    }
    if (qaList.length === 0) {
      setCreateMessage("Q&Aログがありません。もう一度面接を実施してください。");
      return;
    }

    try {
      setIsCreatingCard(true);
      setCreateMessage(null);

      const res = await fetch("/api/story-cards/from-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, personaId, qaList, profile, topicType }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.storyCard) {
        console.error("createStoryCardFromSession error:", { status: res.status, data });
        setCreateMessage("ストーリーカードの保存に失敗しました。時間をおいて再度お試しください。");
      } else {
        setCreateMessage("ストーリーカードを作成しました。ES添削タブに移動します…");
        setTimeout(() => router.push("/es"), 1500);
      }
    } catch (e) {
      console.error("createStoryCardFromSession error:", e);
      setCreateMessage("エラーが発生しました。もう一度お試しください。");
    } finally {
      setIsCreatingCard(false);
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [step]);

  const isLocked = step !== "idle" && step !== "finished";
  const canRetryEval = qaList.length >= MAX_Q && !evaluation;
  const lastJobKey = loadLastJob()?.key || null;

  return (
    <div className="px-10 py-8 space-y-8">
      {/* ✅ 評価時だけ使う MetaConfirmModal（1つだけ） */}
      <MetaConfirmModal
        open={metaModalOpen}
        onClose={closeMetaModal}
        featureLabel={FEATURE_LABEL}
        requiredMeta={metaNeed}
        balance={metaBalance}
        mode={metaMode}
        title={metaTitle}
        message={metaMessage}
        confirmLabel="続行する"
        cancelLabel="キャンセル"
        purchaseLabel="METAを購入する"
        onConfirm={async () => {
          const required = metaNeed;
          const latest = await fetchMyMetaBalance();
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
        onPurchase={() => {
          closeMetaModal();
          router.push("/pricing");
        }}
      />

      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">一般面接AI（音声版）</h1>
        <p className="text-sm text-slate-500">
          ガクチカ・自己PR・志望動機などを、実際の面接に近いかたちで「音声」で練習できるモードです。
          プロフィールが登録されている場合は、あなたの大学・志望業界などに合わせて質問文が少しだけパーソナライズされます。
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {stats.map((s) => (
          <StatCard key={s.label} label={s.label} value={s.value} helper={s.helper} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(280px,360px)] gap-6 items-start">
        {/* 左 */}
        <div className="rounded-3xl bg-white shadow-sm px-6 py-6 flex flex-col gap-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">音声模擬面接（一般質問 × 10問）</h2>
              <p className="text-[11px] text-slate-500">
                「面接官の質問」⇒「あなたが話す」⇒「AIが解析＆評価」という流れで、10問分のやりとりを一気に練習できます。
              </p>
              {startNotice && (
                <p className="mt-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                  {startNotice}
                </p>
              )}
            </div>

            <div className="flex flex-col items-start md:items-end gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-500">面接官タイプ：</span>
                <select
                  className="text-xs border border-slate-200 rounded-full px-3 py-1.5 bg-slate-50"
                  value={personaId}
                  onChange={(e) => {
                    resetPersistenceForInputChange();
                    setPersonaId(e.target.value);
                  }}
                  disabled={isLocked}
                >
                  {PERSONAS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-500">テーマ：</span>
                <select
                  className="text-xs border border-slate-200 rounded-full px-3 py-1.5 bg-slate-50"
                  value={topicType}
                  onChange={(e) => {
                    resetPersistenceForInputChange();
                    setTopicType(e.target.value as TopicType);
                  }}
                  disabled={isLocked}
                >
                  <option value="gakuchika">{TOPIC_LABEL.gakuchika}</option>
                  <option value="self_pr">{TOPIC_LABEL.self_pr}</option>
                  <option value="why_company">{TOPIC_LABEL.why_company}</option>
                  <option value="why_industry">{TOPIC_LABEL.why_industry}</option>
                </select>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-[11px] text-slate-400">
                  進捗：{Math.min(qaList.length + (step === "asking" ? 1 : 0), 10)} / {MAX_Q} 問
                </span>

                {(step === "idle" || step === "finished") && (
                  <button
                    type="button"
                    onClick={startInterview}
                    className="rounded-full bg-sky-500 text-white text-xs px-4 py-2 hover:bg-sky-600 disabled:opacity-60"
                    disabled={!authChecked || !userId}
                  >
                    {step === "finished" ? "もう一度やる" : "面接を開始する"}
                  </button>
                )}
              </div>
            </div>
          </div>

          <div ref={logRef} className="flex-1 max-h-[420px] overflow-y-auto space-y-3 pr-1 pt-2">
            {qaList.length === 0 && step === "idle" && (
              <p className="text-xs text-slate-400">「面接を開始する」を押すと、Q1から順番に音声面接がスタートします。</p>
            )}

            {qaList.map((qa, i) => (
              <div key={i} className="space-y-1">
                <div className="bg-slate-100 px-4 py-2 rounded-xl text-xs text-slate-800">
                  <span className="font-semibold text-sky-700">Q{i + 1}</span>：{qa.question}
                </div>
                <div className="bg-sky-500 text-white px-4 py-2 rounded-xl text-xs">
                  <span className="font-semibold">A：</span> {qa.answer}
                </div>
              </div>
            ))}

            {step !== "idle" && step !== "finished" && (
              <div className="space-y-1">
                <div className="bg-slate-100 px-4 py-2 rounded-xl text-xs text-slate-800">
                  <span className="font-semibold text-sky-700">Q{currentIdx + 1}</span>：{currentQuestion}
                </div>
                {step === "thinking" && <p className="text-[11px] text-slate-500 pl-1">文字起こし中…</p>}
              </div>
            )}
          </div>

          {step === "editing" && (
            <div className="pt-3 border-t border-slate-100">
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 space-y-3">
                <div>
                  <p className="text-xs font-semibold text-slate-800">✨ 文字起こし確認・修正 ✨</p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    認識ズレがあればここで直してから確定してください（確定後にQ&Aへ保存されます）。
                  </p>
                </div>

                <textarea
                  className="w-full min-h-[120px] rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-sky-300"
                  value={pendingTranscript}
                  onChange={(e) => setPendingTranscript(e.target.value)}
                  placeholder="文字起こし結果がここに入ります"
                />

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={retryAnswer}
                    disabled={isCommitting}
                    className="px-3 py-2 rounded-xl text-xs border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-60"
                  >
                    この回答をやり直す
                  </button>

                  <button
                    type="button"
                    onClick={commitEditedTranscript}
                    disabled={isCommitting}
                    className="px-3 py-2 rounded-xl text-xs font-semibold bg-sky-500 text-white hover:bg-sky-600 disabled:opacity-60"
                  >
                    {isCommitting ? "確定中…" : "確定して次へ"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === "asking" && (
            <div className="pt-3 border-t border-slate-100">
              <InterviewRecorder onRecorded={handleRecorded} />
            </div>
          )}

                    {step === "evaluating" && (
            <div className="pt-2 space-y-2">
              <p className="text-[11px] text-slate-500">
                AI が10問分の回答をまとめて解析し、評価を作成しています…（通信が切れても復帰できます）
              </p>

              {/* ✅ evaluating中でも救済ボタンを出す */}
              {canRetryEval && (
                <div className="flex flex-col gap-2">
                  {lastJobKey && (
                    <button
                      type="button"
                      onClick={async () => {
                        if (!lastJobKey) return;
                        setError(null);
                        setStep("evaluating");
                        await pollJobUntilDone(lastJobKey);
                      }}
                      className="rounded-full bg-slate-700 text-white text-xs px-4 py-2 hover:bg-slate-800"
                    >
                      評価の復帰を試す
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={async () => {
                      resetEvaluationJob();
                      setError(null);
                      await runEvaluation(qaList);
                    }}
                    className="rounded-full bg-sky-600 text-white text-xs px-4 py-2 hover:bg-sky-700"
                  >
                    評価を再実行する
                  </button>
                </div>
              )}
            </div>
          )}


          {error && (
            <div className="mt-2 space-y-2">
              <p className="text-[11px] text-red-500 bg-red-50 rounded-xl px-3 py-2">{error}</p>

              {needMeta != null && (
                <button
                  type="button"
                  onClick={() => router.push("/pricing")}
                  className="rounded-full bg-slate-900 text-white text-xs px-4 py-2 hover:bg-slate-800"
                >
                  METAを購入する（必要: {needMeta}）
                </button>
              )}

              {/* ✅ 同じジョブの「復帰」を試す（last_job がある場合） */}
              {loadLastJob()?.key && (
                <button
                  type="button"
                  onClick={async () => {
                    const lj = loadLastJob();
                    if (!lj?.key) return;
                    setError(null);
                    setStep("evaluating");
                    await pollJobUntilDone(lj.key);
                  }}
                  className="rounded-full bg-slate-700 text-white text-xs px-4 py-2 hover:bg-slate-800"
                >
                  評価の復帰を試す
                </button>
              )}

              {/* ✅ 新しいジョブで「評価を再実行」する */}
              {qaList.length >= MAX_Q && !evaluation && (
                <button
                  type="button"
                  onClick={async () => {
                    resetEvaluationJob();
                    setError(null);
                    await runEvaluation(qaList);
                  }}
                  className="rounded-full bg-sky-600 text-white text-xs px-4 py-2 hover:bg-sky-700"
                >
                  評価を再実行する
                </button>
              )}
            </div>
          )}
        </div>

        {/* 右：評価カード */}
        <aside className="w-full">
          <div className="rounded-3xl bg-white shadow-sm px-5 py-5 space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-800 mb-1">面接評価（AI自動解析）</h2>
              {!evaluation && (
                <p className="text-xs text-slate-400">面接が終了すると、ここに総合スコアとフィードバックが表示されます。</p>
              )}
            </div>

            {evaluation && (
              <>
                <div className="space-y-4 text-xs">
                  <div className="rounded-2xl bg-sky-50 px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-[11px] text-sky-700 mb-1">総合スコア</p>
                      <p className="text-2xl font-bold text-sky-700">
                        {evaluation.total_score}
                        <span className="text-xs ml-1">/100</span>
                      </p>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      5人格共通の4軸（STAR / 深さ / 明瞭さ / 話し方）で評価しています。
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-2xl bg-slate-50 px-3 py-2">
                      <p className="text-[11px] text-slate-500">STAR構造</p>
                      <p className="font-semibold text-slate-800">{evaluation.star_score} / 100</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-3 py-2">
                      <p className="text-[11px] text-slate-500">内容の深さ</p>
                      <p className="font-semibold text-slate-800">{evaluation.content_depth_score} / 100</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-3 py-2">
                      <p className="text-[11px] text-slate-500">明瞭さ</p>
                      <p className="font-semibold text-slate-800">{evaluation.clarity_score} / 100</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-3 py-2">
                      <p className="text-[11px] text-slate-500">話し方（WPM・フィラー）</p>
                      <p className="font-semibold text-slate-800">{evaluation.delivery_score} / 100</p>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-emerald-50 px-3 py-3">
                    <p className="font-semibold text-emerald-700 mb-1">Goodポイント</p>
                    <ul className="list-disc list-inside text-emerald-800 space-y-1">
                      {(evaluation.auto_feedback?.good_points ?? []).map((g, i) => (
                        <li key={i}>{g}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-2xl bg-amber-50 px-3 py-3">
                    <p className="font-semibold text-amber-700 mb-1">改善ポイント</p>
                    <ul className="list-disc list-inside text-amber-800 space-y-1">
                      {(evaluation.auto_feedback?.improvement_points ?? []).map((g, i) => (
                        <li key={i}>{g}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-2xl bg-slate-50 px-3 py-3">
                    <p className="font-semibold text-slate-700 mb-1">一言アドバイス</p>
                    <p className="text-slate-600">
                      {evaluation.auto_feedback?.one_sentence_advice ?? "次回以降の面接のポイントがここに表示されます。"}
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 space-y-2">
                  <button
                    type="button"
                    onClick={createStoryCardFromSession}
                    disabled={isCreatingCard}
                    className={`w-full rounded-full px-4 py-2 text-xs font-semibold ${
                      isCreatingCard
                        ? "bg-slate-200 text-slate-500 cursor-not-allowed"
                        : "bg-violet-500 text-white hover:bg-violet-600"
                    }`}
                  >
                    {isCreatingCard ? "ストーリーカード作成中…" : "このセッションからストーリーカードを作成（ES用）"}
                  </button>
                  {createMessage && <p className="text-[11px] text-slate-600">{createMessage}</p>}
                </div>
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
