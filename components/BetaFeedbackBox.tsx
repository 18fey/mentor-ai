"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";

export default function BetaFeedbackBox() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState("");
  const [comment, setComment] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment && !rating) return;

    try {
      setStatus("sending");

      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating,
          comment,
          email,
          page: pathname,
          createdAt: new Date().toISOString(),
        }),
      });

      setStatus("done");
    } catch (e) {
      setStatus("error");
    }
  };

  return (
    <>
      {/* 💬 アイコン */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 h-12 w-12 rounded-full bg-sky-500 text-white shadow-lg flex items-center justify-center text-xl hover:bg-sky-600 transition"
        >
          💬
        </button>
      )}

      {/* 展開UI */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-96 max-w-[90vw]">
          <div className="rounded-2xl bg-white/95 backdrop-blur-md border border-slate-200 shadow-xl p-5 space-y-4">

            {/* ヘッダー */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">Beta</p>
                <p className="font-semibold text-slate-900">
                  フィードバックください🫶
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            {status === "done" ? (
              <div className="text-emerald-700 text-sm bg-emerald-50 rounded-xl p-3">
                送信ありがとう！<br />改善に活かします✨
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3 text-sm">

                {/* 評価 */}
                <div>
                  <p className="text-slate-500 text-xs mb-1">使い心地</p>
                  <div className="flex gap-1">
                    {["1","2","3","4","5"].map(v => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setRating(v)}
                        className={`h-8 w-8 rounded-full border text-xs ${
                          rating === v ? "bg-sky-500 text-white" : "bg-white"
                        }`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>

                {/* コメント */}
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                  placeholder="改善してほしい点・感想など"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 focus:ring-2 focus:ring-sky-400 outline-none"
                />

                {/* 任意連絡先 */}
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="連絡先（任意）"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 outline-none"
                />

                <button
                  type="submit"
                  className="w-full rounded-full bg-sky-500 py-2 text-white font-medium hover:bg-sky-600"
                >
                  送信する
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
