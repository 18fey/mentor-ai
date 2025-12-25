// src/components/GeneralInterviewAI.tsx
"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import type { TopicType } from "@/lib/types/story";
import { MetaConfirmModal } from "@/components/MetaConfirmModal";

type ChatMessage = {
  id: string;
  from: "system" | "ai" | "user";
  text: string;
};

type StoryCard = {
  id: string;
  topicType: TopicType;
  title: string;
  star: {
    situation: string;
    task: string;
    action: string;
    result: string;
  };
  learnings: string;
  axes: string[];
};

type StoredStoryCard = StoryCard & {
  dbId: string;
  createdAt: string;
};

const TOPIC_LABEL: Record<TopicType, string> = {
  gakuchika: "ガクチカ（学生時代に力を入れたこと）",
  self_pr: "自己PR",
  why_company: "志望動機（企業）",
  why_industry: "志望動機（業界）",
  general: "",
};

const INITIAL_QUESTION: Record<TopicType, string> = {
  gakuchika:
    "学生時代に『一番時間とエネルギーをかけた経験』を、まずはざっくり1〜2行で教えてください。",
  self_pr:
    "あなたが『自分の強み』だと思うものを、エピソードに関係なく素直な言葉で教えてください。",
  why_company:
    "その企業（または第1志望企業）に惹かれている理由を、思いつくままに3つほど挙げてください。",
  why_industry:
    "その業界を志望している理由を、最初に思いつくままに教えてください。",
  general: "",
};

const FOLLOW_UP_QUESTIONS = [
  "その状況（S）を、もう少し具体的に教えてください。（いつ / どこで / 誰と）",
  "その中で、あなたが背負っていた『役割や目標（T）』は何でしたか？",
  "その目標に対して、あなたが実際に取った行動（A）をできるだけ細かく教えてください。",
  "その結果（R）として、何がどう変わりましたか？ 数字・事実ベースで教えてください。",
  "この経験から『得た学び・強み・価値観』を、言葉にすると何になりますか？",
];

const DEEP_DIVE_QUESTIONS: string[] = [
  "この経験の中で、一番しんどかった瞬間はいつですか？ そのとき何を感じていましたか？",
  "そのとき、周りの人はあなたのことをどう見ていたと思いますか？",
  "振り返ってみて『ここはもっとこうすればよかった』と感じるポイントはどこですか？",
  "この経験を10秒で要約するとしたら、どんなフレーズになりますか？",
  "似たような状況がもう一度来たら、今回と同じ行動を取りますか？ それとも変えますか？",
  "この経験が、あなたの『就活の軸』や『価値観』に与えた影響は何ですか？",
  "このエピソードを面接で話したとき、面接官に一番伝えたいメッセージは何ですか？",
  "他のガクチカ / 自己PRエピソードと比べて、この経験ならではのユニークさは何ですか？",
];

/* -------------------------------
   v8 Supabase Client（Component用）
-------------------------------- */
function createClientSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export const GeneralInterviewAI: React.FC = () => {
  const router = useRouter();
  const supabase = createClientSupabase();

  const [authLoading, setAuthLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const [topic, setTopic] = useState<TopicType>("gakuchika");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [stepIndex, setStepIndex] = useState<number>(-1);
  const [deepDiveIndex, setDeepDiveIndex] = useState<number>(-1);

  const [storyDraft, setStoryDraft] = useState<StoryCard | null>(null);
  const [fixedCard, setFixedCard] = useState<StoryCard | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [cloudCards, setCloudCards] = useState<StoredStoryCard[]>([]);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isSensitive, setIsSensitive] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  // ✅ セッション開始中（連打防止）
  const [isStarting, setIsStarting] = useState(false);

  // ✅ 共通METAモーダル状態
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

  // ✅ 残高取得（UI用）。/api/meta/balance はサーバ側で getMyMetaBalance を呼ぶ想定
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

  // -------- 認証ユーザー取得 --------
  useEffect(() => {
    const fetchUser = async () => {
      setAuthLoading(true);
      setAuthError(null);
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (error) {
          console.error("getUser error:", error);
          setAuthError("ログイン情報の取得に失敗しました。再読み込みしてください。");
          setUserId(null);
        } else if (!user) {
          setAuthError("ログインが必要です。");
          setUserId(null);
        } else {
          setUserId(user.id);

          // ✅ balance も先に取得しておく（なくても動く）
          const b = await fetchMyBalance();
          if (typeof b === "number") setMetaBalance(b);
        }
      } catch (e) {
        console.error(e);
        setAuthError("ログイン情報の取得に失敗しました。");
        setUserId(null);
      } finally {
        setAuthLoading(false);
      }
    };

    fetchUser();
  }, [supabase]);

  // -------- クラウド保存済みカード取得（ユーザー別）--------
  useEffect(() => {
    if (!userId) return;

    const fetchCards = async () => {
      try {
        const res = await fetch(
          `/api/story-cards?userId=${encodeURIComponent(userId)}`
        );
        const data = await res.json();
        if (data.storyCards) {
          const mapped: StoredStoryCard[] = data.storyCards.map((row: any) => ({
            dbId: row.id,
            createdAt: row.created_at,
            topicType: row.topic_type as TopicType,
            title: row.title,
            star: {
              situation: row.star_situation ?? "",
              task: row.star_task ?? "",
              action: row.star_action ?? "",
              result: row.star_result ?? "",
            },
            learnings: row.learnings ?? "",
            axes: Array.isArray(row.axes) ? row.axes : [],
            id: row.id,
          }));
          setCloudCards(mapped);
        }
      } catch (e) {
        console.error("Failed to fetch story cards:", e);
      }
    };
    fetchCards();
  }, [userId]);

  const extractAxesFromLearnings = (text: string): string[] => {
    const axes: string[] = [];
    const t = text.toLowerCase();

    if (t.includes("主体") || t.includes("自分から") || t.includes("オーナー")) {
      axes.push("主体性 / オーナーシップ");
    }
    if (t.includes("チーム") || t.includes("協力") || t.includes("巻き込")) {
      axes.push("チームワーク / 巻き込み力");
    }
    if (t.includes("継続") || t.includes("粘り") || t.includes("粘り強")) {
      axes.push("粘り強さ / 継続力");
    }
    if (t.includes("改善") || t.includes("工夫") || t.includes("試行錯誤")) {
      axes.push("改善志向 / PDCA");
    }
    if (axes.length === 0) {
      axes.push("成長意欲 / 学習姿勢");
    }
    return axes;
  };

  const canStart = useMemo(
    () => !authLoading && !!userId && stepIndex === -1 && !isStarting,
    [authLoading, userId, stepIndex, isStarting]
  );

  /**
   * ✅ セッション開始の本体（featureGateはAPI側でやる想定）
   * - ここは「本当に開始する」処理だけ
   */
  const startSessionCore = async () => {
    if (!userId) return;

    setStartError(null);
    setSaveMessage(null);

    const res = await fetch("/api/interview/session/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        topic,
        isSensitive,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      console.error("session/start error", res.status, body);

      // ✅ featureGateで meta不足 (402) の場合は purchase モード
      if (res.status === 402) {
        const requiredMeta = Number(body?.required ?? body?.requiredMeta ?? 1);
        const b =
          typeof body?.balance === "number"
            ? Number(body.balance)
            : await fetchMyBalance();

        setMetaNeed(requiredMeta);
        setMetaBalance(typeof b === "number" ? b : metaBalance);
        setMetaMode("purchase");
        setMetaTitle("METAが不足しています");
        setMetaMessage(`この実行には META が ${requiredMeta} 必要です。購入して続行してください。`);
        setMetaModalOpen(true);
        return;
      }

      setStartError(
        body?.message ??
          "セッションの作成に失敗しました。時間をおいて再度お試しください。"
      );
      return;
    }

    const data = await res.json().catch(() => ({}));
    const createdSessionId: string | null =
      data.sessionId ?? data.session?.id ?? null;

    setSessionId(createdSessionId);

    const intro: ChatMessage[] = [
      {
        id: "sys-1",
        from: "system",
        text: "このモードでは、5〜10分で1つの経験をSTAR形式に整理して『ストーリーカード』を作ります。",
      },
      {
        id: "ai-1",
        from: "ai",
        text: INITIAL_QUESTION[topic],
      },
    ];
    setMessages(intro);

    setStoryDraft({
      id: `draft-${Date.now()}`,
      topicType: topic,
      title:
        topic === "gakuchika"
          ? "ガクチカエピソード"
          : topic === "self_pr"
          ? "自己PRエピソード"
          : topic === "why_company"
          ? "志望企業に関する経験"
          : "志望業界に関する経験",
      star: { situation: "", task: "", action: "", result: "" },
      learnings: "",
      axes: [],
    });

    setStepIndex(0);
    setDeepDiveIndex(-1);
    setCurrentAnswer("");
    setFixedCard(null);

    // ✅ freeでmeta消費が起きた可能性があるのでbalance更新（取れれば）
    const b = await fetchMyBalance();
    if (typeof b === "number") setMetaBalance(b);
  };

  /**
   * ✅ セッション開始（UIゲート）
   * - usage/consume は無料枠カウントのみ（=need_meta を返す）
   * - 課金の真実は /api/interview/session/start 側 featureGate
   */
  const handleStart = async () => {
    if (!userId) return;

    if (isStarting) return;
    setIsStarting(true);

    setStartError(null);
    setSaveMessage(null);

    try {
      // ① 無料枠チェック（usage）
      const usageRes = await fetch("/api/usage/consume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feature: "general_interview" }),
      });

      const usageBody: any = await usageRes.json().catch(() => ({}));

      // A) 無料枠内 or pro相当 → そのまま開始
      if (usageRes.ok) {
        await startSessionCore();
        return;
      }

      // B) 無料枠超過 → confirm/purchase を共通モーダルで
      if (usageRes.status === 402 && usageBody?.error === "need_meta") {
        const requiredMeta = Number(usageBody.requiredMeta ?? 1);

        const b = await fetchMyBalance();
        setMetaNeed(requiredMeta);
        setMetaBalance(typeof b === "number" ? b : metaBalance);

        const mode: "confirm" | "purchase" =
          typeof b === "number" && b < requiredMeta ? "purchase" : "confirm";

        setMetaMode(mode);
        setMetaTitle(undefined);
        setMetaMessage(undefined);

        setPendingAction(async () => {
          await startSessionCore();
        });

        setMetaModalOpen(true);
        return;
      }

      // その他
      console.error("usage/consume unexpected", usageRes.status, usageBody);
      setStartError("開始条件の確認に失敗しました。時間をおいて再度お試しください。");
    } catch (e) {
      console.error(e);
      setStartError("ネットワークエラーにより、セッションを開始できませんでした。");
    } finally {
      setIsStarting(false);
    }
  };

  // ------- 回答送信処理 -------
  const handleSend = () => {
    if (!currentAnswer.trim() || storyDraft == null) return;

    const answerText = currentAnswer.trim();

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      from: "user",
      text: answerText,
    };

    const updatedCard: StoryCard = { ...storyDraft };

    if (stepIndex === 0) updatedCard.star.situation = answerText;
    else if (stepIndex === 1) updatedCard.star.task = answerText;
    else if (stepIndex === 2) updatedCard.star.action = answerText;
    else if (stepIndex === 3) updatedCard.star.result = answerText;
    else if (stepIndex === 4) {
      updatedCard.learnings = answerText;
      updatedCard.axes = extractAxesFromLearnings(answerText);
    }

    const nextMessages: ChatMessage[] = [userMsg];

    if (stepIndex >= 0 && stepIndex < FOLLOW_UP_QUESTIONS.length - 1) {
      nextMessages.push({
        id: `ai-${Date.now()}`,
        from: "ai",
        text: FOLLOW_UP_QUESTIONS[stepIndex + 1],
      });
      setStepIndex(stepIndex + 1);
    } else if (stepIndex === FOLLOW_UP_QUESTIONS.length - 1) {
      nextMessages.push({
        id: `ai-summary-${Date.now()}`,
        from: "ai",
        text:
          "ありがとうございます。この内容をもとに右側にストーリーカードを整理しました。",
      });

      if (DEEP_DIVE_QUESTIONS.length > 0) {
        nextMessages.push({
          id: `ai-deep-${Date.now()}`,
          from: "ai",
          text: "ここからは深掘り質問をします。\n\n" + DEEP_DIVE_QUESTIONS[0],
        });
        setDeepDiveIndex(0);
      }

      setStepIndex(FOLLOW_UP_QUESTIONS.length);
    } else if (stepIndex >= FOLLOW_UP_QUESTIONS.length) {
      const nextIdx =
        deepDiveIndex >= 0
          ? (deepDiveIndex + 1) % DEEP_DIVE_QUESTIONS.length
          : 0;

      nextMessages.push({
        id: `ai-deep-${Date.now()}`,
        from: "ai",
        text: DEEP_DIVE_QUESTIONS[nextIdx],
      });

      setDeepDiveIndex(nextIdx);
    }

    setMessages((prev) => [...prev, ...nextMessages]);
    setStoryDraft(updatedCard);
    setCurrentAnswer("");
    setSaveMessage(null);
  };

  // ------- Supabase 保存（ユーザー別）-------
  const handleSaveToSupabase = async () => {
    if (!storyDraft) return;
    if (!sessionId) {
      setSaveMessage("まずセッションを開始してください。");
      return;
    }
    if (!userId) {
      setSaveMessage("ログイン情報を取得できませんでした。");
      return;
    }

    setIsSaving(true);
    setSaveMessage(null);

    try {
      const res = await fetch("/api/story-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          sessionId,
          isSensitive,
          topicType: storyDraft.topicType,
          title: storyDraft.title,
          star: storyDraft.star,
          learnings: storyDraft.learnings,
          axes: storyDraft.axes,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.storyCard) {
        console.error("Save error:", data);
        setSaveMessage(data?.message ?? "保存に失敗しました。");
      } else {
        setSaveMessage(
          isSensitive
            ? "センシティブ扱いとして保存しました（週次レポートから除外）。"
            : "Supabase に保存しました。"
        );

        const row = data.storyCard;

        const stored: StoredStoryCard = {
          dbId: row.id,
          createdAt: row.created_at,
          topicType: row.topic_type as TopicType,
          title: row.title,
          star: {
            situation: row.star_situation ?? "",
            task: row.star_task ?? "",
            action: row.star_action ?? "",
            result: row.star_result ?? "",
          },
          learnings: row.learnings ?? "",
          axes: Array.isArray(row.axes) ? row.axes : [],
          id: row.id,
        };

        setCloudCards((prev) => [stored, ...prev]);
        setFixedCard(storyDraft);
      }
    } catch (e) {
      console.error(e);
      setSaveMessage("エラーで保存できませんでした。");
    } finally {
      setIsSaving(false);
    }
  };

  const previewCard = fixedCard ?? storyDraft;

  const stepLabel =
    stepIndex >= 0 && stepIndex < FOLLOW_UP_QUESTIONS.length
      ? `STEP ${stepIndex + 1} / ${FOLLOW_UP_QUESTIONS.length}`
      : stepIndex >= FOLLOW_UP_QUESTIONS.length
      ? `STEP ${FOLLOW_UP_QUESTIONS.length} / ${FOLLOW_UP_QUESTIONS.length}`
      : "STEP 0 / 5";

  return (
    <>
      <div className="flex h-full gap-6">
        {/* 左側：チャット */}
        <div className="flex-1 flex flex-col rounded-2xl border border-slate-200 bg-white/80 shadow-sm">
          {/* ヘッダー */}
          <div className="flex flex-col gap-2 border-b border-slate-100 px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h1 className="text-sm font-semibold text-slate-900">
                  一般面接AI（自己分析・深掘り）
                </h1>
                <p className="text-[11px] text-slate-500">
                  テーマを選び、STAR形式で深掘りします。
                </p>
                {authLoading && (
                  <p className="mt-1 text-[10px] text-slate-400">
                    ログイン情報を読み込み中です…
                  </p>
                )}
                {!authLoading && authError && (
                  <p className="mt-1 text-[10px] text-rose-600">{authError}</p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <select
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value as TopicType)}
                  disabled={stepIndex >= 0 || isStarting}
                >
                  <option value="gakuchika">{TOPIC_LABEL.gakuchika}</option>
                  <option value="self_pr">{TOPIC_LABEL.self_pr}</option>
                  <option value="why_company">{TOPIC_LABEL.why_company}</option>
                  <option value="why_industry">{TOPIC_LABEL.why_industry}</option>
                </select>

                <button
                  type="button"
                  onClick={handleStart}
                  disabled={!canStart}
                  className={`rounded-full px-4 py-1.5 text-xs font-semibold ${
                    canStart
                      ? "bg-sky-500 text-white hover:bg-sky-600"
                      : "bg-slate-200 text-slate-500 cursor-not-allowed"
                  }`}
                >
                  {isStarting ? "確認中…" : "セッション開始"}
                </button>
              </div>
            </div>

            {/* センシティブチェック */}
            <label className="flex items-start gap-2 text-[11px] text-slate-700">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={isSensitive}
                onChange={(e) => setIsSensitive(e.target.checked)}
                disabled={!canStart}
              />
              <span>
                センシティブ内容を含む可能性があります
                <span className="block text-[10px] text-slate-500">
                  健康・家族構成・宗教・政治などのデリケートな内容はレポートから除外されます。
                </span>
              </span>
            </label>

            {startError && <p className="text-[10px] text-red-500">{startError}</p>}
          </div>

          {/* メッセージログ */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 text-xs">
            {messages.length === 0 && (
              <p className="text-slate-400">
                テーマとセンシティブ設定を選び、「セッション開始」を押してください。
              </p>
            )}

            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-3 py-2 shadow-sm ${
                    m.from === "user"
                      ? "bg-sky-500 text-white rounded-br-sm"
                      : m.from === "ai"
                      ? "bg-slate-50 text-slate-800 rounded-bl-sm"
                      : "bg-amber-50 text-amber-800 border border-amber-100"
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
          </div>

          {/* 入力エリア */}
          <div className="border-t border-slate-100 px-4 py-3">
            <textarea
              className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-sky-300"
              rows={3}
              value={currentAnswer}
              placeholder={
                stepIndex === -1
                  ? "セッションを開始すると入力できます。"
                  : "面接で話すイメージで入力してください。"
              }
              onChange={(e) => setCurrentAnswer(e.target.value)}
            />

            <div className="mt-2 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">{stepLabel}</span>
              <button
                type="button"
                onClick={handleSend}
                disabled={stepIndex === -1 || !currentAnswer.trim()}
                className={`rounded-full px-4 py-1.5 font-semibold ${
                  stepIndex === -1 || !currentAnswer.trim()
                    ? "bg-slate-200 text-slate-500 cursor-not-allowed"
                    : "bg-sky-500 text-white hover:bg-sky-600"
                }`}
              >
                送信
              </button>
            </div>
          </div>
        </div>

        {/* 右側：ストーリーカード */}
        <aside className="w-80 shrink-0 space-y-4">
          <div className="rounded-2xl border border-sky-100 bg-sky-50/70 p-4 shadow-sm">
            <h2 className="text-xs font-semibold text-sky-700 mb-1">
              ストーリーカード（プレビュー）
            </h2>
            <p className="text-[11px] text-slate-600 mb-3">
              ES・面接でそのまま使える「1枚の台本」です。
            </p>

            {previewCard ? (
              <div className="space-y-2 text-xs text-slate-800">
                <div>
                  <p className="text-[11px] text-slate-500">テーマ</p>
                  <p className="font-medium">{TOPIC_LABEL[previewCard.topicType]}</p>
                </div>

                <div>
                  <p className="text-[11px] text-slate-500">タイトル（仮）</p>
                  <p className="font-semibold">{previewCard.title}</p>
                </div>

                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold text-slate-500">STAR構造</p>
                  <p>
                    <span className="font-semibold">S：</span>
                    {previewCard.star.situation}
                  </p>
                  <p>
                    <span className="font-semibold">T：</span>
                    {previewCard.star.task}
                  </p>
                  <p>
                    <span className="font-semibold">A：</span>
                    {previewCard.star.action}
                  </p>
                  <p>
                    <span className="font-semibold">R：</span>
                    {previewCard.star.result}
                  </p>
                </div>

                <div>
                  <p className="text-[11px] font-semibold text-slate-500">学び・強み</p>
                  <p>{previewCard.learnings}</p>
                </div>

                <div>
                  <p className="text-[11px] font-semibold text-slate-500 mb-1">
                    この経験から見える「就活の軸」
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {previewCard.axes.map((axis) => (
                      <span
                        key={axis}
                        className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] text-sky-700 border border-sky-100"
                      >
                        {axis}
                      </span>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSaveToSupabase}
                  disabled={isSaving}
                  className={`mt-2 w-full rounded-full px-3 py-1.5 text-[11px] font-semibold text-white ${
                    isSaving
                      ? "bg-slate-300 cursor-not-allowed"
                      : "bg-violet-500 hover:bg-violet-600"
                  }`}
                >
                  {isSaving ? "保存中…" : "このカードを Supabase に保存"}
                </button>

                {saveMessage && (
                  <p className="mt-1 text-[11px] text-slate-600">{saveMessage}</p>
                )}
              </div>
            ) : (
              <p className="text-[11px] text-slate-500">
                セッションを開始すると内容が表示されます。
              </p>
            )}
          </div>

          {/* 保存済み一覧 */}
          <div className="rounded-2xl border border-slate-100 bg-white/80 p-4 shadow-sm">
            <p className="text-[11px] font-semibold text-slate-800 mb-2">
              クラウド保存済みストーリーカード
            </p>

            {cloudCards.length === 0 ? (
              <p className="text-[11px] text-slate-500">まだ保存されたカードはありません。</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {cloudCards.map((card) => (
                  <div
                    key={card.dbId}
                    className="rounded-xl border border-slate-100 bg-slate-50/80 p-2 text-[11px]"
                  >
                    <p className="text-slate-500">{TOPIC_LABEL[card.topicType]}</p>
                    <p className="font-semibold text-slate-800 truncate">{card.title}</p>
                    <p className="text-slate-400 text-[10px] mt-1">
                      {new Date(card.createdAt).toLocaleString("ja-JP")}
                    </p>
                    <p className="mt-1 text-slate-600 line-clamp-2">{card.star.situation}</p>
                  </div>
                ))}
              </div>
            )}

            <p className="mt-2 text-[10px] text-slate-400">
              ES添削AIでも、このデータを共有できます。
            </p>
          </div>
        </aside>
      </div>

      {/* ✅ 共通METAモーダル（usage:無料枠 / featureGate:課金の真実） */}
      <MetaConfirmModal
        open={metaModalOpen}
        onClose={closeMetaModal}
        featureLabel="一般面接AI（自己分析・深掘り）"
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
