"use client";

import React, { useEffect, useRef, useState } from "react";

const THINK_TIME = 600; // 10分
const SPEAK_TIME = 600; // 10分

type CaseDataLite = {
  id: string;
  title: string;
  client: string;
  prompt: string;
};

export const CaseInterviewLive: React.FC<{ caseData: CaseDataLite }> = ({ caseData }) => {
  const [phase, setPhase] = useState<"idle" | "thinking" | "speaking" | "processing">("idle");
  const [timeLeft, setTimeLeft] = useState<number>(THINK_TIME);
  const [transcript, setTranscript] = useState<string>("");
  const [uiError, setUiError] = useState<string | null>(null);

  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (phase !== "thinking" && phase !== "speaking") {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          timerRef.current = null;

          if (phase === "thinking") {
            void startRecording();
          } else if (phase === "speaking") {
            stopRecording();
          }

          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [phase]);

  const startThinking = () => {
    setUiError(null);
    setTranscript("");
    setPhase("thinking");
    setTimeLeft(THINK_TIME);
  };

  const startRecording = async () => {
    setUiError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);

      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        void handleTranscription();
      };

      recorder.start();
      setMediaRecorder(recorder);
      setPhase("speaking");
      setTimeLeft(SPEAK_TIME);
    } catch (e) {
      console.error(e);
      setUiError("マイク権限が必要です。ブラウザ設定で許可してください。");
      setPhase("idle");
    }
  };

  const stopRecording = () => {
    setUiError(null);

    try {
      if (!mediaRecorder) return;

      mediaRecorder.stop();
      mediaRecorder.stream.getTracks().forEach((t) => t.stop());
      setPhase("processing");
    } catch (e) {
      console.error(e);
      setUiError("録音停止に失敗しました。");
      setPhase("idle");
    }
  };

  const handleTranscription = async () => {
    try {
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      chunksRef.current = [];

      const formData = new FormData();
      formData.append("file", blob);

      const res = await fetch("/api/case/transcribe", {
        method: "POST",
        body: formData,
      });

      const data: any = await res.json().catch(() => ({}));

      if (!res.ok || !data?.ok) {
        setUiError(data?.message ?? "文字起こしに失敗しました。");
        setPhase("idle");
        return;
      }

      const text = String(data.transcript ?? "");
      setTranscript(text);

      await fetch("/api/eval/case", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Idempotency-Key": `live_${Date.now()}`,
        },
        body: JSON.stringify({
          case: caseData,
          answers: {
            goal: "",
            kpi: "",
            framework: "",
            hypothesis: "",
            deepDivePlan: "",
            analysis: text,
            solutions: "",
            risks: "",
            wrapUp: "",
          },
        }),
      }).catch(() => {
        // 評価失敗は UI を止めない
      });

      setPhase("idle");
    } catch (e) {
      console.error(e);
      setUiError("処理中にエラーが発生しました。");
      setPhase("idle");
    }
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-4 rounded-2xl border p-6 bg-white shadow">
      <h2 className="text-lg font-semibold">Live Case Mode</h2>

      <div className="rounded-xl bg-slate-50 p-4 text-sm">
        <p className="font-semibold">{caseData.client}</p>
        <p className="mt-2 whitespace-pre-wrap">{caseData.prompt}</p>
      </div>

      {uiError && (
        <div className="rounded-xl border border-rose-100 bg-rose-50 p-3 text-xs text-rose-700">
          {uiError}
        </div>
      )}

      {phase === "idle" && (
        <button
          onClick={startThinking}
          className="rounded-full bg-violet-600 px-6 py-2 text-white"
        >
          10分思考スタート
        </button>
      )}

      {phase === "thinking" && (
        <button
          onClick={() => void startRecording()}
          className="rounded-full bg-violet-600 px-6 py-2 text-white"
        >
          思考終了 → 発表スタート
        </button>
      )}

      {(phase === "thinking" || phase === "speaking") && (
        <div className="text-2xl font-bold text-center">⏳ {formatTime(timeLeft)}</div>
      )}

      {phase === "speaking" && (
        <button
          onClick={stopRecording}
          className="rounded-full bg-red-500 px-6 py-2 text-white"
        >
          発表終了
        </button>
      )}

      {phase === "processing" && (
        <div className="text-center text-sm text-slate-500">文字起こし & 評価中...</div>
      )}

      {transcript && (
        <div className="mt-4 rounded-xl border bg-slate-50 p-3 text-xs">
          <p className="font-semibold mb-1">文字起こし結果：</p>
          <pre className="whitespace-pre-wrap">{transcript}</pre>
        </div>
      )}
    </div>
  );
};