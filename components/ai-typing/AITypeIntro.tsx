// components/ai-typing/AITypeIntro.tsx
"use client";

type Props = {
  onStart: () => void;
  onSkip: () => void;
};

export function AITypeIntro({ onStart, onSkip }: Props) {
  return (
    <div className="w-full max-w-2xl rounded-3xl border border-white/40 bg-white/80 p-8 shadow-[0_18px_45px_rgba(15,23,42,0.12)] backdrop-blur-[30px]">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-sky-500">
        AI THINKING OS
      </p>
      <h1 className="mb-2 text-xl font-semibold text-slate-900">
        あなたの AI思考タイプを、2分で診断しませんか？
      </h1>
      <p className="mb-6 text-sm text-slate-600">
        Mentor.AI 独自の「AI THINKING OS」は、あなたの
        <span className="font-semibold">「AIとの付き合い方」</span>
        を16タイプに可視化します。就活・キャリア戦略・日々の思考トレーニングの
        “基本OS” として使える診断です。
      </p>

      <ul className="mb-6 space-y-2 text-xs text-slate-600">
        <li>・ 所要時間：2〜3分</li>
        <li>・ 正解・不正解はありません（直感でOK）</li>
        <li>・ 診断結果から、あなた専用の学習ルートを自動設計します</li>
      </ul>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={onStart}
          className="inline-flex items-center justify-center rounded-full bg-sky-500 px-6 py-2 text-xs font-semibold text-white shadow-sm hover:bg-sky-600"
        >
          AIタイプ診断を開始する →
        </button>

        <button
          type="button"
          onClick={onSkip}
          className="text-[11px] text-slate-400 underline-offset-2 hover:text-slate-600 hover:underline"
        >
          今はスキップしてダッシュボードへ進む
        </button>
      </div>
    </div>
  );
}
