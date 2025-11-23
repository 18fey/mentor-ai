"use client";

import { useEffect, useRef, useState } from "react";

type InterviewRecorderProps = {
  onRecorded?: (audioBlob: Blob) => void;
};

export function InterviewRecorder({ onRecorded }: InterviewRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<number | null>(null);

  // ------------------------------
  // 録音タイマー管理
  // ------------------------------
  useEffect(() => {
    if (isRecording) {
      setSeconds(0);
      const id = window.setInterval(() => {
        setSeconds((prev) => prev + 1);
      }, 1000);
      timerRef.current = id;
    } else if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }

    return () => {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
      }
    };
  }, [isRecording]);

  // ------------------------------
  // 録音開始
  // ------------------------------
  const startRecording = async () => {
    setError(null);
    setAudioUrl(null);
    setAudioBlob(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        chunksRef.current = [];

        const url = URL.createObjectURL(blob);
        setAudioBlob(blob);
        setAudioUrl(url);

        // 親へ返す
        onRecorded && onRecorded(blob);

        // マイク停止
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch (e) {
      console.error(e);
      setError("マイクにアクセスできません。ブラウザ設定をご確認ください。");
    }
  };

  // ------------------------------
  // 録音停止
  // ------------------------------
  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // ------------------------------
  // リセット
  // ------------------------------
  const reset = () => {
    setAudioUrl(null);
    setAudioBlob(null);
    setSeconds(0);
    setError(null);
  };

  return (
    <div className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-xs font-semibold text-slate-700 mb-2">
        🎙 回答録音（音声入力）
      </p>

      {/* 状態表示 */}
      <div className="flex justify-between items-center text-xs text-slate-600 mb-2">
        <span>
          状態：{" "}
          {isRecording ? (
            <span className="text-red-500 font-semibold">録音中</span>
          ) : audioUrl ? (
            "録音完了"
          ) : (
            "待機中"
          )}
        </span>
        <span className="text-slate-500">経過：{seconds} 秒</span>
      </div>

      {/* ボタン */}
      <div className="flex gap-3 text-xs">
        {!isRecording && !audioUrl && (
          <button
            className="px-4 py-2 bg-sky-500 text-white rounded-full hover:bg-sky-600"
            onClick={startRecording}
          >
            ▶ 録音開始
          </button>
        )}

        {isRecording && (
          <button
            className="px-4 py-2 bg-red-500 text-white rounded-full hover:bg-red-600"
            onClick={stopRecording}
          >
            ■ 録音停止
          </button>
        )}

        {audioUrl && !isRecording && (
          <button
            className="px-4 py-2 border border-slate-300 rounded-full text-slate-600"
            onClick={reset}
          >
            ↺ やり直す
          </button>
        )}
      </div>

      {/* 再生エリア */}
      {audioUrl && (
        <div className="pt-3 border-t border-slate-100 mt-3">
          <p className="text-xs text-slate-600 mb-1">録音した音声：</p>
          <audio src={audioUrl} controls className="w-full" />
        </div>
      )}

      {error && (
        <p className="text-xs text-red-500 bg-red-50 mt-3 p-2 rounded-xl">
          {error}
        </p>
      )}

      <p className="text-[10px] text-slate-400 mt-2">
        ※停止すると自動で AI に渡す準備が完了します。
      </p>
    </div>
  );
}
