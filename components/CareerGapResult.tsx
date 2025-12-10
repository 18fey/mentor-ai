// components/CareerGapResult.tsx
"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type CareerGapResultProps = {
  markdown: string;
};

export const CareerGapResult: React.FC<CareerGapResultProps> = ({
  markdown,
}) => {
  if (!markdown) return null;

  return (
    <section className="mt-6 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm shadow-slate-100">
      <h3 className="mb-3 text-sm font-semibold text-slate-900">
        キャリア相性レポート
      </h3>

      {/* Markdown を構造としてレンダリング */}
      <div className="prose prose-sm max-w-none text-slate-800 prose-headings:mt-4 prose-headings:mb-2 prose-p:my-1 prose-li:my-0.5">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {markdown}
        </ReactMarkdown>
      </div>
    </section>
  );
};
