// components/ai-typing/AITypeDiagnosis.tsx
"use client";

import { useState } from "react";
import {
  aiTypologyQuestions,
  AIQuestion,
  AITypeKey,
  calculateAIType,
} from "@/lib/aiTypologyData";

type Props = {
  onComplete: (resultKey: AITypeKey) => void;
  onBackToIntro: () => void;
};

export function AITypeDiagnosis({ onComplete, onBackToIntro }: Props) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<AITypeKey[]>([]);
  const [answering, setAnswering] = useState(false);

  const total = aiTypologyQuestions.length;
  const question: AIQuestion = aiTypologyQuestions[index];
  const progress = ((index + 1) / total) * 100;

  const handleSelect = (typeKey: AITypeKey) => {
    if (answering) return;
    setAnswering(true);

    const newAnswers = [...answers, typeKey];

    if (index === total - 1) {
      const resultKey = calculateAIType(newAnswers);
      onComplete(resultKey);
      return;
    }

    setAnswers(newAnswers);
    setTimeout(() => {
      setIndex((prev) => prev + 1);
      setAnswering(false);
    }, 180); // 軽くディレイ
  };

  return (
    <div className="w-full max-w-2xl rounded-3xl border border-white/40 bg-white/80 p-8 shadow-[0_18px_45px_rgba(15,23,42,0.12)] backdrop-blur-[30px]">
      <div className="mb-4 flex items-center justify-between text-[11px] text-slate-500">
        <span className="font-semibold tracking-[0.18em] text-sky-500">
          MENTOR.AI TYPOLOGY
        </span>
        <span>
          Q{index + 1} / {total}
        </span>
      </div>

      {/* 進捗バー */}
      <div className="mb-6 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-sky-500 transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>

      <p className="mb-2 text-[11px] text-slate-400">直感で選んでください。</p>
      <h2 className="mb-5 text-base font-semibold text-slate-900">{question.text}</h2>

      <div className="grid gap-3 md:grid-cols-2">
        {question.options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => handleSelect(opt.typeKey)}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-xs text-slate-700 shadow-sm hover:border-sky-300 hover:bg-sky-50"
          >
            {opt.label}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={onBackToIntro}
        className="mt-6 text-[11px] text-slate-400 underline-offset-2 hover:text-slate-600 hover:underline"
      >
        最初の案内画面に戻る
      </button>
    </div>
  );
}
