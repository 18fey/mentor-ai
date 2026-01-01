"use client";

import { useEffect, useRef, useState } from "react";
import { InterviewRecorder } from "@/components/InterviewRecorder";

type QA = { question: string; answer: string };

const SYSTEM_QUESTIONS = [
  "それでは模擬面接を始めます。まずは簡単に自己紹介をお願いします。",
  "学生時代に最も力を入れた取り組みを教えてください。",
  "その中で直面した最大の課題（困難）は何でしたか？",
  "その課題に対して、あなたが取った具体的な行動を教えてください。",
  "その行動の結果として、状況はどのように変化しましたか？",
  "この経験から得た学びを一言で言うと何ですか？",
  "周囲のメンバーからはどのように評価されましたか？",
  "今振り返って『ここはもっと改善できた』と思う点はありますか？",
  "あなたらしさが最も現れている部分はどこですか？",
  "最後に、この経験を通じて言える“あなたの強み”は何ですか？",
];

const MAX_Q = 10;

export default function VoiceInterviewPage() {
  const [step, setStep] = useState<
    "idle" | "asking" | "thinking" | "evaluating" | "finished"
  >("idle");

  const [qaList, setQAList] = useState<QA[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [evaluation, setEvaluation] = useState<any>(null);

  // ログ表示のスクロール管理
  const logRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    setTimeout(() => {
      logRef.current?.scrollTo({
        top: logRef.current.scrollHeight,
        behavior: "smooth",
      });
    }, 150);
  };

  // -------------------------------------
  // 面接開始
  // -------------------------------------
  const startInterview = () => {
    setQAList([]);
    setEvaluation(null);
    setCurrentIdx(0);
    setCurrentQuestion(SYSTEM_QUESTIONS[0]);
    setStep("asking");
    scrollToBottom();
  };

  // -------------------------------------
  // 録音後 → Whisper → 次へ
  // -------------------------------------
  const handleRecorded = async (blob: Blob) => {
    setStep("thinking");
    scrollToBottom();

    // Whisperに送信
    const fd = new FormData();
    fd.append("audio", blob);

    const res = await fetch("/api/transcribe", {
      method: "POST",
      body: fd,
    });

    const data = await res.json();
    const transcript = data.transcript ?? "（文字起こし失敗）";

    // ログに追加
    setQAList((prev) => [
      ...prev,
      { question: currentQuestion, answer: transcript },
    ]);

    scrollToBottom();

    // 次の質問へ
    const next = currentIdx + 1;
    if (next >= MAX_Q) {
      runEvaluation([...qaList, { question: currentQuestion, answer: transcript }]);
      return;
    }

    setCurrentIdx(next);
    setCurrentQuestion(SYSTEM_QUESTIONS[next]);
    setStep("asking");
    scrollToBottom();
  };

  // -------------------------------------
  // 10問終了 → 評価実施
  // -------------------------------------
  const runEvaluation = async (finishedList: QA[]) => {
    setStep("evaluating");
    scrollToBottom();

    const res = await fetch("/api/interview-eval", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ qaList: finishedList }),
    });

    const evalData = await res.json();
    setEvaluation(evalData);

    setStep("finished");
    scrollToBottom();
  };

  return (
    <div className="flex gap-6">
      {/* -------------------------------- 左カラム（面接ログ） ------------------------------- */}
      <div className="flex-1 rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm flex flex-col">
        <h1 className="text-sm font-semibold text-slate-800 mb-4">
          音声一般面接AI（β版）
        </h1>

        {/* スタート前 */}
        {step === "idle" && (
          <button
            onClick={startInterview}
            className="px-4 py-2 bg-sky-600 text-white rounded-full text-sm hover:bg-sky-700"
          >
            面接を開始するB
          </button>
        )}

        {/* ログ一覧 */}
        <div
          ref={logRef}
          className="flex-1 space-y-4 overflow-y-auto pr-2 scroll-smooth"
        >
          {/* 過去の Q&A */}
          {qaList.map((qa, i) => (
            <div key={i} className="space-y-1">
              <div className="bg-slate-100 px-4 py-2 rounded-xl text-xs text-slate-800">
                <span className="font-semibold text-sky-700">Q{i + 1}</span>
                ：{qa.question}
              </div>
              <div className="bg-sky-500 text-white px-4 py-2 rounded-xl text-xs">
                <span className="font-semibold">A：</span> {qa.answer}
              </div>
            </div>
          ))}

          {/* 現在の質問 */}
          {step === "asking" && (
            <div className="bg-slate-100 px-4 py-2 rounded-xl text-xs text-slate-800">
              <span className="font-semibold text-sky-700">
                Q{currentIdx + 1}
              </span>
              ：{currentQuestion}
            </div>
          )}

          {step === "thinking" && (
            <p className="text-xs text-slate-500 pl-1">AI が回答を解析中…</p>
          )}
        </div>

        {/* 録音コンポーネント（質問中のみ） */}
        {step === "asking" && (
          <div className="mt-4">
            <InterviewRecorder onRecorded={handleRecorded} />
          </div>
        )}

        {step === "evaluating" && (
          <p className="text-xs text-slate-500 mt-3">AI が総合評価を作成中…</p>
        )}

        {/* 終了後の操作 */}
        {step === "finished" && (
          <div className="mt-4">
            <button
              onClick={startInterview}
              className="px-4 py-2 bg-violet-600 text-white rounded-full text-sm hover:bg-violet-700"
            >
              もう一度やる
            </button>
          </div>
        )}
      </div>

      {/* -------------------------------- 右カラム（評価結果） ------------------------------- */}
      <aside className="w-80 shrink-0">
        <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm sticky top-6">
          <h2 className="text-sm font-semibold text-slate-800 mb-3">
            面接評価（AI解析）
          </h2>

          {!evaluation && (
            <p className="text-xs text-slate-400">
              面接が終了すると、ここに評価結果が表示されます。
            </p>
          )}

          {evaluation && (
            <div className="space-y-4 text-xs">
              {/* 総合スコア */}
              <div className="rounded-xl bg-sky-50 p-3">
                <p className="text-sky-700 text-[11px]">総合スコア</p>
                <p className="text-2xl font-bold text-sky-700">
                  {evaluation.total_score}
                  <span className="text-xs ml-1">/100</span>
                </p>
              </div>

              {/* 個別スコア */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-slate-50 p-3">
                  STAR：{evaluation.star_score}/100
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  深さ：{evaluation.content_depth_score}/100
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  明瞭さ：{evaluation.clarity_score}/100
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  話し方：{evaluation.delivery_score}/100
                </div>
              </div>

              {/* Goodポイント */}
              <div className="rounded-xl bg-emerald-50 p-3">
                <p className="font-semibold text-emerald-700 mb-1">Good</p>
                <ul className="ml-4 space-y-1 text-emerald-800 list-disc">
                  {evaluation.auto_feedback.good_points.map(
                    (g: string, i: number) => (
                      <li key={i}>{g}</li>
                    )
                  )}
                </ul>
              </div>

              {/* 改善ポイント */}
              <div className="rounded-xl bg-amber-50 p-3">
                <p className="font-semibold text-amber-700 mb-1">改善</p>
                <ul className="ml-4 space-y-1 text-amber-800 list-disc">
                  {evaluation.auto_feedback.improvement_points.map(
                    (g: string, i: number) => (
                      <li key={i}>{g}</li>
                    )
                  )}
                </ul>
              </div>

              {/* 一言アドバイス */}
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="font-semibold text-slate-700 mb-1">アドバイス</p>
                <p className="text-slate-600">
                  {evaluation.auto_feedback.one_sentence_advice}
                </p>
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
