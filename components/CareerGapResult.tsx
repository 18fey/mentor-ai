// components/CareerGapResult.tsx
"use client";

import React from "react";

type CareerGapResultProps = {
  markdown: string;
};

export const CareerGapResult: React.FC<CareerGapResultProps> = ({
  markdown,
}) => {
  if (!markdown) return null;

  return (
    <section className="mt-6 rounded-2xl border border-slate-100 bg-white/95 p-5 shadow-sm shadow-slate-100">
      <h3 className="mb-3 text-sm font-semibold text-slate-900">
        キャリア相性レポート
      </h3>
      <div className="prose prose-sm max-w-none text-slate-800 prose-headings:mt-4 prose-headings:mb-2 prose-p:my-1 prose-ul:my-1 prose-li:my-0.5">
        <pre className="whitespace-pre-wrap break-words bg-transparent p-0 text-sm leading-relaxed text-slate-800">
          {markdown}
        </pre>
      </div>
    </section>
  );
};
