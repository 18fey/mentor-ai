"use client";

import { useState, useEffect } from "react";
import { InterviewRecorder } from "./InterviewRecorder";

type QA = { question: string; answer: string };

const SYSTEM_QUESTIONS = [
  "それでは面接を始めます。まず簡単に自己紹介をお願いします。",
  "学生時代に最も力を入れたことを教えてください。",
  "その中で直面した最大の課題は何でしたか？",
  "なぜその行動を取ったのですか？背景を教えてください。",
  "結果としてどのような変化が起きましたか？",
  "そこから得た学びを一言で言うと何ですか？",
  "周囲の反応や評価はどうでしたか？",
  "似た状況が再び起きた場合、同じ行動を取りますか？",
  "あなたらしさが現れている部分を教えてください。",
  "最後に、この経験から言えるあなたの強みは何ですか？",
];

const MAX_Q = 10;

export function InterviewSession() {
  const [step, setStep] = useState<"idle"|"asking"|"recording"|"thinking"|"finished">("idle");
  const [qaList, setQAList] = useState<QA[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [evaluation, setEvaluation] = useState<any>(null);

  // 面接スタート
  const startInterview = () => {
    setQAList([]);
    setCurrentQuestionIndex(0);
    setCurrentQuestion(SYSTEM_QUESTIONS[0]);
    setStep("asking");
  };

  // 録音完了 → Whisper → 次の質問へ
  const handleRecorded = async (blob: Blob) => {
    setStep("thinking");

    // Whisper APIへ送信
    const form = new FormData();
    form.append("audio", blob);

    const res = await fetch("/api/transcribe", { method: "POST", body: form });
    const data = await res.json();

    const transcript = data.transcript ?? "(文字起こし失敗)";

    // QAを追加
    setQAList(prev => [
      ...prev,
      { question: currentQuestion, answer: transcript }
    ]);

    // 次の質問
    const next = currentQuestionIndex + 1;
    if (next >= MAX_Q) {
      finishInterview();
      return;
    }

    setCurrentQuestionIndex(next);
    setCurrentQuestion(SYSTEM_QUESTIONS[next]);
    setStep("asking");
  };

  // 10問終了 → 評価APIへ
  const finishInterview = async () => {
    setStep("finished");

    const res = await fetch("/api/interview-eval", {
      method: "POST",
      headers: { "Content-Type": "application/json"},
      body: JSON.stringify({ qaList }),
    });

    const data = await res.json();
    setEvaluation(data);
  };

  return (
    <div className="flex gap-6">
      {/* 左：面接ログ */}
      <div className="flex-1 rounded-2xl border border-slate-200 bg-white/80 shadow-sm p-4 space-y-4">
        <h2 className="text-sm font-semibold">一般面接AI（音声版）</h2>

        {/* スタート前 */}
        {step === "idle" && (
          <button
            onClick={startInterview}
            className="px-4 py-2 bg-sky-500 text-white rounded-full"
          >
            面接を開始する
          </button>
        )}

        {/* ログ */}
        <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">

          {qaList.map((qa, i) => (
            <div key={i} className="space-y-1">
              <div className="bg-slate-50 px-3 py-2 rounded-xl">
                <span className="font-semibold text-sky-700">Q{i+1}：</span>
                {qa.question}
              </div>
              <div className="bg-sky-500 text-white px-3 py-2 rounded-xl">
                <span className="font-semibold">A：</span> {qa.answer}
              </div>
            </div>
          ))}

          {/* 今の質問 */}
          {step === "asking" && (
            <div className="bg-slate-100 text-slate-800 px-3 py-2 rounded-xl">
              <span className="font-semibold text-sky-600">
                Q{currentQuestionIndex+1}：
              </span>{" "}
              {currentQuestion}
            </div>
          )}

        </div>

        {/* 録音セクション */}
        {step === "asking" && (
          <InterviewRecorder onRecorded={handleRecorded} />
        )}

        {step === "thinking" && (
          <p className="text-xs text-slate-500">AIが回答を読んでいます…</p>
        )}

        {step === "finished" && (
          <p className="text-xs text-slate-500">評価を計算中…</p>
        )}
      </div>

      {/* 右：評価エリア */}
      <aside className="w-80 shrink-0">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">

          <h3 className="text-sm font-semibold mb-3">評価</h3>

          {!evaluation && <p className="text-xs text-slate-400">
            面接が終了すると、ここに評価が表示されます。
          </p>}

          {evaluation && (
            <div className="space-y-3">
              <div className="rounded-xl bg-sky-50 p-3">
                <p className="text-xs text-sky-700">総合スコア</p>
                <p className="text-xl font-semibold text-sky-700">
                  {evaluation.total_score}/100
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-50 p-2 rounded-xl">
                  STAR：{evaluation.star_score}/100
                </div>
                <div className="bg-slate-50 p-2 rounded-xl">
                  深さ：{evaluation.content_depth_score}/100
                </div>
                <div className="bg-slate-50 p-2 rounded-xl">
                  明瞭さ：{evaluation.clarity_score}/100
                </div>
                <div className="bg-slate-50 p-2 rounded-xl">
                  話し方：{evaluation.delivery_score}/100
                </div>
              </div>

              <div className="bg-emerald-50 p-3 rounded-xl">
                <p className="font-semibold text-emerald-700">Goodポイント</p>
                <ul className="list-disc ml-4 text-emerald-800">
                  {evaluation.auto_feedback.good_points.map((g: string, i: number) => (
                    <li key={i}>{g}</li>
                  ))}
                </ul>
              </div>

              <div className="bg-amber-50 p-3 rounded-xl">
                <p className="font-semibold text-amber-700">改善ポイント</p>
                <ul className="list-disc ml-4 text-amber-800">
                  {evaluation.auto_feedback.improvement_points.map((g: string, i: number) => (
                    <li key={i}>{g}</li>
                  ))}
                </ul>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl">
                <p className="font-semibold text-slate-700">一言アドバイス</p>
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
