// app/case/page.tsx
"use client";

import { CaseInterviewAI } from "@/components/CaseInterviewAI";

export default function CasePage() {
  return (
    <div className="min-h-screen bg-[#F3F6FD] px-6 py-6 md:px-10 md:py-8">
      <header className="mb-6 flex flex-col gap-2">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-xs text-sky-600 shadow-sm border border-white/60">
          <span className="inline-block h-2 w-2 rounded-full bg-sky-400" />
          Mentor.AI Case Interview Module
        </div>
        <h1 className="text-2xl md:text-3xl font-semibold text-slate-900">
          ケース面接AI
        </h1>
        <p className="text-sm md:text-base text-slate-500">
          業界別モードでトレーニングできます。
          ゴール設定 → フレーム提出 → 仮説 → 打ち手 → クロージング まで、一連の流れを型に沿って練習できます。
        </p>
      </header>

      <main className="rounded-3xl border border-white/80 bg-white/80 shadow-sm backdrop-blur-sm p-4 md:p-6 h-[calc(100vh-180px)]">
        <CaseInterviewAI />
      </main>
    </div>
  );
}


