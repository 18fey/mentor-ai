// app/general/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { StatCard } from "@/components/StatCard";
import { InterviewRecorder } from "@/components/InterviewRecorder";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import type { TopicType } from "@/lib/types/story";

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

// 5人格（Evaluation APIと同じID）
const PERSONAS = [
  { id: "consulting_finance", label: "コンサル・外銀系" },
  { id: "sales_trading_commerce", label: "商社・営業・流通系" },
  { id: "finance_banking_insurance", label: "金融（銀行・証券・保険）系" },
  { id: "maker_it_telecom", label: "メーカー・IT・通信系" },
  { id: "service_education_entertainment", label: "サービス・教育・エンタメ系" },
];

const TOPIC_LABEL: Record<TopicType, string> = {
  gakuchika: "ガクチカ（学生時代に力を入れたこと）",
  self_pr: "自己PR",
  why_company: "志望動機（企業）",
  why_industry: "志望動機（業界）",
  general: "",
};

// ✅ editing 追加
type Step = "idle" | "asking" | "thinking" | "editing" | "evaluating" | "finished";

// 学びテキストから「就活の軸」タグをざっくり抽出（いまは未使用だが、今後のために残しておく）
function extractAxesFromLearnings(text: string): string[] {
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
}

// プロフィール有無で質問文を少しだけ変える
function buildQuestions(profile: Profile | null): string[] {
  const hasProfile = !!profile;
  const name = profile?.name || "あなた";
  const uni = profile?.university || "大学";
  const faculty = profile?.faculty || "";
  const grade = profile?.grade || "";
  const mainIndustry = profile?.interested_industries?.[0];

  const baseIntro = hasProfile
    ? `まずは ${name} さんの簡単な自己紹介をお願いします。（${uni}${faculty ? ` / ${faculty}` : ""}${grade ? ` / ${grade}年` : ""} などを含めて）`
    : "それでは模擬面接を始めます。まずは簡単に自己紹介をお願いします。";

  const baseGakuchika = hasProfile
    ? `${uni} での学生生活の中で、特に力を入れた取り組みを教えてください。`
    : "学生時代に最も力を入れた取り組みを教えてください。";

  const industryTail = mainIndustry
    ? `（特に ${mainIndustry} を志望している前提で考えてみてください）`
    : "";

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

export default function InterviewPage() {
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

  // ✅ 編集用（一時置き）
  const [pendingTranscript, setPendingTranscript] = useState<string>("");
  const [isCommitting, setIsCommitting] = useState(false);

  const [isCreatingCard, setIsCreatingCard] = useState(false);
  const [createMessage, setCreateMessage] = useState<string | null>(null);

  const logRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push("/auth");
          return;
        }
        setUserId(user.id);

        const res = await fetch(`/api/profile/get?userId=${encodeURIComponent(user.id)}`);
        const data = await res.json();
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

  const startInterview = () => {
    if (!authChecked || !userId) {
      router.push("/auth");
      return;
    }
    setQAList([]);
    setEvaluation(null);
    setCurrentIdx(0);
    setCurrentQuestion(questions[0]);
    setStep("asking");
    setError(null);
    setCreateMessage(null);
    setPendingTranscript("");
    setIsCommitting(false);
    scrollToBottom();
  };

  // ✅ 10問終了 → /api/interview-eval
  const runEvaluation = async (finishedList: QA[]) => {
    try {
      setStep("evaluating");
      scrollToBottom();

      const res = await fetch("/api/interview-eval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ persona_id: personaId, qaList: finishedList, userId }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "面接評価APIでエラーが発生しました。");
      }

      const evalData = (await res.json()) as EvaluationResult;
      setEvaluation(evalData);
      setStep("finished");
      scrollToBottom();
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "面接評価の作成中にエラーが発生しました。時間をおいて再度お試しください。");
      setStep("finished");
    }
  };

  // ✅ 録音完了 → /api/transcribe → editingへ（ここではQA保存しない）
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
      setError(
        e?.message ||
          "文字起こし中にエラーが発生しました。通信環境を確認して、もう一度お試しください。"
      );
      setStep("asking");
    }
  };

  // ✅ 確定：QAに保存 → 次へ or 評価へ
  const commitEditedTranscript = async () => {
    if (isCommitting) return;
    setIsCommitting(true);
    setError(null);

    try {
      const answer = pendingTranscript.trim() || "（空の回答）";

      const newQA: QA = { question: currentQuestion, answer };
      const nextList = [...qaList, newQA];
      setQAList(nextList);

      // 次に持ち越さない
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

  // ✅ やり直し：同じ質問で再録音（QAには保存しない）
  const retryAnswer = () => {
    setPendingTranscript("");
    setError(null);
    setStep("asking");
    scrollToBottom();
  };

  // -------------------------------------
  // このセッション → ストーリーカード作成（from-audio API を使用）
  // -------------------------------------
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

  return (
    <div className="px-10 py-8 space-y-8">
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
          {/* ヘッダー行 */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">音声模擬面接（一般質問 × 10問）</h2>
              <p className="text-[11px] text-slate-500">
                「面接官の質問」⇒「あなたが話す」⇒「AIが解析＆評価」という流れで、10問分のやりとりを一気に練習できます。
              </p>
            </div>

            <div className="flex flex-col items-start md:items-end gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-500">面接官タイプ：</span>
                <select
                  className="text-xs border border-slate-200 rounded-full px-3 py-1.5 bg-slate-50"
                  value={personaId}
                  onChange={(e) => setPersonaId(e.target.value)}
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
                  onChange={(e) => setTopicType(e.target.value as TopicType)}
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
                    className="rounded-full bg-sky-500 text-white text-xs px-4 py-2 hover:bg-sky-600"
                    disabled={!authChecked || !userId}
                  >
                    {step === "finished" ? "もう一度やる" : "面接を開始する"}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Q&Aログ */}
          <div
            ref={logRef}
            className="flex-1 max-h-[420px] overflow-y-auto space-y-3 pr-1 pt-2"
          >
            {qaList.length === 0 && step === "idle" && (
              <p className="text-xs text-slate-400">
                「面接を開始する」を押すと、Q1から順番に音声面接がスタートします。
              </p>
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

            {/* 現在の質問 */}
            {step !== "idle" && step !== "finished" && (
              <div className="space-y-1">
                <div className="bg-slate-100 px-4 py-2 rounded-xl text-xs text-slate-800">
                  <span className="font-semibold text-sky-700">Q{currentIdx + 1}</span>：{currentQuestion}
                </div>

                {step === "thinking" && (
                  <p className="text-[11px] text-slate-500 pl-1">文字起こし中…</p>
                )}
              </div>
            )}
          </div>

          {/* ✅ editing UI */}
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

          {/* 録音 */}
          {step === "asking" && (
            <div className="pt-3 border-t border-slate-100">
              <InterviewRecorder onRecorded={handleRecorded} />
            </div>
          )}

          {step === "evaluating" && (
            <p className="text-[11px] text-slate-500 pt-2">
              AI が10問分の回答をまとめて解析し、評価を作成しています…
            </p>
          )}

          {error && (
            <p className="text-[11px] text-red-500 bg-red-50 rounded-xl px-3 py-2 mt-2">
              {error}
            </p>
          )}
        </div>

        {/* 右：評価カード */}
        <aside className="w-full">
          <div className="rounded-3xl bg-white shadow-sm px-5 py-5 space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-800 mb-1">面接評価（AI自動解析）</h2>
              {!evaluation && (
                <p className="text-xs text-slate-400">
                  面接が終了すると、ここに総合スコアとフィードバックが表示されます。
                </p>
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
                      {evaluation.auto_feedback?.one_sentence_advice ??
                        "次回以降の面接のポイントがここに表示されます。"}
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
