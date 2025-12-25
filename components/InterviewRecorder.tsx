"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type InterviewRecorderProps = {
  onRecorded?: (audioBlob: Blob) => void | Promise<void>;
  disabled?: boolean;
  maxSeconds?: number; // 任意：上限秒数（例 120）
};

function pickMimeType(): string | undefined {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4", // Safari系で通ることがある（環境差あり）
  ];

  for (const c of candidates) {
    // @ts-ignore
    if (
      typeof MediaRecorder !== "undefined" &&
      MediaRecorder.isTypeSupported?.(c)
    ) {
      return c;
    }
  }
  return undefined;
}

export function InterviewRecorder({
  onRecorded,
  disabled = false,
  maxSeconds,
}: InterviewRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);

  // 🎚 入力レベル（0〜1）
  const [level, setLevel] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<number | null>(null);

  // 🎚 WebAudio refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);

  const mimeType = useMemo(() => pickMimeType(), []);

  // URL を作り直す場合に revoke する
  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopTracks = () => {
    try {
      streamRef.current?.getTracks()?.forEach((t) => t.stop());
    } catch {}
    streamRef.current = null;
  };

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // ------------------------------
  // 🎚 入力レベルメーター
  // ------------------------------
  const stopLevelMeter = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    try {
      analyserRef.current?.disconnect();
    } catch {}
    analyserRef.current = null;

    try {
      audioCtxRef.current?.close();
    } catch {}
    audioCtxRef.current = null;

    setLevel(0);
  };

  const startLevelMeter = (stream: MediaStream) => {
    try {
      const AudioCtx =
        window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx: AudioContext = new AudioCtx();
      const analyser = audioCtx.createAnalyser();

      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.85;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      audioCtxRef.current = audioCtx;
      analyserRef.current = analyser;

      const data = new Uint8Array(analyser.fftSize);

      const tick = () => {
        if (!analyserRef.current) return;

        analyserRef.current.getByteTimeDomainData(data);

        // RMS（音量）計算（0〜1）
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128; // -1〜1
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);

        // 体感調整：少しブースト（環境差あり）
        const boosted = Math.min(1, rms * 2.8);

        setLevel(boosted);
        rafRef.current = requestAnimationFrame(tick);
      };

      rafRef.current = requestAnimationFrame(tick);
    } catch (e) {
      console.error("startLevelMeter error", e);
      // メーターだけ失敗しても録音は続けられる
      setLevel(0);
    }
  };

  // ------------------------------
  // 録音タイマー
  // ------------------------------
  useEffect(() => {
    clearTimer();

    if (isRecording) {
      const id = window.setInterval(() => {
        setSeconds((prev) => {
          const next = prev + 1;
          if (typeof maxSeconds === "number" && next >= maxSeconds) {
            stopRecording(); // 上限到達で自動停止
          }
          return next;
        });
      }, 1000);
      timerRef.current = id;
    }

    return () => clearTimer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRecording, maxSeconds]);

  const startRecording = async () => {
    if (disabled) return;

    setError(null);

    // 既存URLを破棄
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setAudioBlob(null);
    setSeconds(0);

    // 既存メーター停止（念のため）
    stopLevelMeter();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // 🎚 メーター開始
      startLevelMeter(stream);

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        setError("録音中にエラーが発生しました。もう一度お試しください。");
        setIsRecording(false);
        stopLevelMeter();
        stopTracks();
      };

      recorder.onstop = async () => {
        try {
          const typeGuess = mimeType?.includes("mp4")
            ? "audio/mp4"
            : "audio/webm";

          const blob = new Blob(chunksRef.current, { type: typeGuess });
          chunksRef.current = [];

          const url = URL.createObjectURL(blob);
          setAudioBlob(blob);
          setAudioUrl(url);

          if (onRecorded) await onRecorded(blob);
        } catch (e) {
          console.error(e);
          setError("録音データの処理に失敗しました。");
        } finally {
          stopLevelMeter();
          stopTracks();
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch (e) {
      console.error(e);
      setError("マイクにアクセスできません。ブラウザ設定をご確認ください。");
      stopLevelMeter();
      stopTracks();
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    const r = mediaRecorderRef.current;
    if (!r) return;

    if (r.state === "recording") {
      try {
        r.stop();
      } catch {}
    }
    setIsRecording(false);
  };

  const reset = () => {
    if (isRecording) stopRecording();

    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setAudioBlob(null);
    setSeconds(0);
    setError(null);
    chunksRef.current = [];

    stopLevelMeter();
    stopTracks();
  };

  const canStart = !disabled && !isRecording;
  const canStop = isRecording;

  return (
    <div className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center justify-between gap-3 mb-2">
        <p className="text-xs font-semibold text-slate-700">
          🎙 回答録音（音声入力）
        </p>

        {/* 🎚 リング（声に反応） */}
        {isRecording && (
          <div className="flex items-center gap-2">
            <div
              className="h-3 w-3 rounded-full bg-red-500"
              style={{
                transform: `scale(${1 + level * 1.8})`,
                opacity: 0.35 + level * 0.65,
                transition: "transform 60ms linear, opacity 60ms linear",
              }}
            />
            <span className="text-[10px] text-slate-500">入力レベル</span>
          </div>
        )}
      </div>

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

      {/* 🎚 バー（声に反応） */}
      {isRecording && (
        <div className="mb-3">
          <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-sky-500 transition-[width] duration-75"
              style={{ width: `${Math.round(level * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* ボタン */}
      <div className="flex gap-3 text-xs">
        {!isRecording && !audioUrl && (
          <button
            className={`px-4 py-2 rounded-full text-white ${
              canStart
                ? "bg-sky-500 hover:bg-sky-600"
                : "bg-slate-300 cursor-not-allowed"
            }`}
            onClick={startRecording}
            disabled={!canStart}
            type="button"
          >
            ▶ 録音開始
          </button>
        )}

        {canStop && (
          <button
            className="px-4 py-2 bg-red-500 text-white rounded-full hover:bg-red-600"
            onClick={stopRecording}
            type="button"
          >
            ■ 録音停止
          </button>
        )}

        {audioUrl && !isRecording && (
          <button
            className="px-4 py-2 border border-slate-300 rounded-full text-slate-600 hover:bg-slate-50"
            onClick={reset}
            type="button"
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
        {typeof maxSeconds === "number" ? `（最大 ${maxSeconds} 秒）` : ""}
      </p>
    </div>
  );
}
