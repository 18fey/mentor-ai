"use client";

import React, { useMemo, useState } from "react";
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

type Step = "idle" | "asking" | "thinking" | "editing" | "evaluating" | "finished";

export function InterviewSession() {
  const [step, setStep] = useState<Step>("idle");
  const [qaList, setQAList] = useState<QA[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState("");

  const [evaluation, setEvaluation] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ✅ 文字起こしの「仮置き」(編集して確定するまでQAに保存しない)
  const [pendingTranscript, setPendingTranscript] = useState<string>("");
  const [isCommitting, setIsCommitting] = useState(false);

  const progressLabel = useMemo(() => {
    const done = qaList.length;
    return `${done}/${MAX_Q}`;
  }, [qaList.length]);

  const startInterview = () => {
    setErrorMessage(null);
    setEvaluation(null);
    setQAList([]);
    setCurrentQuestionIndex(0);
    setCurrentQuestion(SYSTEM_QUESTIONS[0]);
    setPendingTranscript("");
    setIsCommitting(false);
    setStep("asking");
  };

  const finishInterview = async (finalQaList: QA[]) => {
    setStep("evaluating");
    setErrorMessage(null);

    try {
      const res = await fetch("/api/interview-eval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qaList: finalQaList }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMessage(data?.message ?? "評価の取得に失敗しました。");
        setStep("finished");
        return;
      }

      setEvaluation(data);
      setStep("finished");
    } catch (e) {
      console.error(e);
      setErrorMessage("ネットワークエラーで評価に失敗しました。");
      setStep("finished");
    }
  };

  // 録音完了 → Whisper → 編集画面へ
  const handleRecorded = async (blob: Blob) => {
    setStep("thinking");
    setErrorMessage(null);

    try {
      const form = new FormData();
      form.append("audio", blob);

      const res = await fetch("/api/transcribe", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = data?.message ?? "文字起こしに失敗しました。";
        throw new Error(msg);
      }

      const transcript =
        String(data?.transcript ?? "").trim() || "(文字起こし失敗)";

      // ✅ ここでは保存しない。編集用に仮置きして editing へ
      setPendingTranscript(transcript);
      setStep("editing");
    } catch (e: any) {
      console.error(e);
      setErrorMessage(e?.message ?? "音声処理中にエラーが発生しました。");
      // 同じ質問を続けられるように戻す
      setStep("asking");
    }
  };

  // ✅ 確定：QAに保存 → 次へ or 評価へ
  const commitEditedTranscript = async () => {
    if (isCommitting) return;
    setIsCommitting(true);
    setErrorMessage(null);

    try {
      const answer = pendingTranscript.trim() || "(空の回答)";

      // 次のqaListを確定（stateの取りこぼし防止）
      const nextList: QA[] = [...qaList, { question: currentQuestion, answer }];
      setQAList(nextList);

      // pendingをクリア（次の質問に持ち越さない）
      setPendingTranscript("");

      const nextIndex = currentQuestionIndex + 1;

      if (nextIndex >= MAX_Q) {
        await finishInterview(nextList);
        return;
      }

      setCurrentQuestionIndex(nextIndex);
      setCurrentQuestion(SYSTEM_QUESTIONS[nextIndex]);
      setStep("asking");
    } catch (e: any) {
      console.error(e);
      setErrorMessage(e?.message ?? "確定処理中にエラーが発生しました。");
      // 編集画面に留まる
      setStep("editing");
    } finally {
      setIsCommitting(false);
    }
  };

  // ✅ やり直し：同じ質問に戻して再録音
  const retryAnswer = () => {
    setPendingTranscript("");
    setErrorMessage(null);
    setStep("asking");
  };

  const canStart = step === "idle" || step === "finished";
  const recorderDisabled = step !== "asking";

  return (
    <div className="flex gap-6">
      {/* 左：面接ログ */}
      <div className="flex-1 rounded-2xl border border-slate-200 bg-white/80 shadow-sm p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">一般面接AI（音声版）</h2>
          <span className="text-[11px] text-slate-500">進捗：{progressLabel}</span>
        </div>

        {/* スタート */}
        {canStart && (
          <button
            onClick={startInterview}
            className="px-4 py-2 bg-sky-500 text-white rounded-full hover:bg-sky-600"
            type="button"
          >
            面接を開始する
          </button>
        )}

        {/* エラー */}
        {errorMessage && (
          <p className="text-xs text-rose-600 bg-rose-50 p-2 rounded-xl">
            {errorMessage}
          </p>
        )}

        {/* ログ */}
        <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
          {qaList.map((qa, i) => (
            <div key={i} className="space-y-1">
              <div className="bg-slate-50 px-3 py-2 rounded-xl">
                <span className="font-semibold text-sky-700">Q{i + 1}：</span>
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
                Q{currentQuestionIndex + 1}：
              </span>{" "}
              {currentQuestion}
            </div>
          )}
        </div>

        {/* 録音 */}
        {step === "asking" && (
          <InterviewRecorder
            onRecorded={handleRecorded}
            disabled={recorderDisabled}
            maxSeconds={120}
          />
        )}

        {step === "thinking" && (
          <p className="text-xs text-slate-500">文字起こし中…</p>
        )}

        {/* ✅ 文字起こし確認・修正 */}
        {step === "editing" && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
            <div>
              <p className="text-xs font-semibold text-slate-800">
                ✨ 文字起こし確認・修正 ✨
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                認識ズレがあればここで直してから確定してください（その後にQAへ保存されます）。
              </p>
            </div>

            <div className="bg-slate-50 px-3 py-2 rounded-xl text-xs text-slate-700">
              <span className="font-semibold text-sky-700">
                Q{currentQuestionIndex + 1}：
              </span>{" "}
              {currentQuestion}
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
        )}

        {step === "evaluating" && (
          <p className="text-xs text-slate-500">評価を計算中…</p>
        )}
      </div>

      {/* 右：評価エリア */}
      <aside className="w-80 shrink-0">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold mb-3">評価</h3>

          {!evaluation && (
            <p className="text-xs text-slate-400">
              面接が終了すると、ここに評価が表示されます。
            </p>
          )}

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
                  {(evaluation.auto_feedback?.good_points ?? []).map(
                    (g: string, i: number) => (
                      <li key={i}>{g}</li>
                    )
                  )}
                </ul>
              </div>

              <div className="bg-amber-50 p-3 rounded-xl">
                <p className="font-semibold text-amber-700">改善ポイント</p>
                <ul className="list-disc ml-4 text-amber-800">
                  {(evaluation.auto_feedback?.improvement_points ?? []).map(
                    (g: string, i: number) => (
                      <li key={i}>{g}</li>
                    )
                  )}
                </ul>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl">
                <p className="font-semibold text-slate-700">一言アドバイス</p>
                <p className="text-slate-600">
                  {evaluation.auto_feedback?.one_sentence_advice ?? ""}
                </p>
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
