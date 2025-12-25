"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type CareerGapResultProps = {
  markdown: string;
};

export const CareerGapResult: React.FC<CareerGapResultProps> = ({ markdown }) => {
  if (!markdown) return null;

  return (
    <section className="mt-6 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm shadow-slate-100">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">キャリア相性レポート</h3>
        <span className="text-[11px] text-slate-400">Markdown表示</span>
      </div>

      {/* ✅ 余白/行間/リスト/見出しを本番向けに最適化 */}
      <div className="prose max-w-none text-slate-800 prose-p:my-3 prose-li:my-1 prose-strong:text-slate-900">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1: ({ children, ...props }) => (
              <h1
                className="mt-0 mb-4 text-lg font-semibold tracking-tight text-slate-900"
                {...props}
              >
                {children}
              </h1>
            ),
            h2: ({ children, ...props }) => (
              <h2
                className="mt-6 mb-2 text-base font-semibold text-slate-900"
                {...props}
              >
                {children}
              </h2>
            ),
            h3: ({ children, ...props }) => (
              <h3
                className="mt-5 mb-2 text-sm font-semibold text-slate-900"
                {...props}
              >
                {children}
              </h3>
            ),
            p: ({ children, ...props }) => (
              <p className="text-[13px] leading-relaxed text-slate-800" {...props}>
                {children}
              </p>
            ),
            ul: ({ children, ...props }) => (
              <ul className="my-3 list-disc pl-5" {...props}>
                {children}
              </ul>
            ),
            ol: ({ children, ...props }) => (
              <ol className="my-3 list-decimal pl-5" {...props}>
                {children}
              </ol>
            ),
            li: ({ children, ...props }) => (
              <li className="text-[13px] leading-relaxed text-slate-800" {...props}>
                {children}
              </li>
            ),
            hr: (props) => <hr className="my-6 border-slate-200" {...props} />,
            blockquote: ({ children, ...props }) => (
              <blockquote
                className="my-4 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-[13px] leading-relaxed text-slate-700"
                {...props}
              >
                {children}
              </blockquote>
            ),
            a: ({ children, ...props }) => (
              <a className="text-sky-700 underline underline-offset-2" {...props}>
                {children}
              </a>
            ),
            code: ({ children, ...props }) => (
              <code
                className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[12px] text-slate-800"
                {...props}
              >
                {children}
              </code>
            ),
          }}
        >
          {markdown}
        </ReactMarkdown>
      </div>
    </section>
  );
};
