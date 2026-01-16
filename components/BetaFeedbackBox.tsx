"use client";

import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";

type Status = "idle" | "sending" | "done" | "error";

export default function BetaFeedbackBox() {
  const pathname = usePathname();

  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState("");
  const [comment, setComment] = useState("");
  const [email, setEmail] = useState("");

  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");

  const canSubmit = useMemo(() => {
    return status !== "sending" && (!!comment.trim() || !!rating);
  }, [status, comment, rating]);

  const resetForm = () => {
    setRating("");
    setComment("");
    setEmail("");
    setErrorMsg("");
    setStatus("idle");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    try {
      setStatus("sending");
      setErrorMsg("");

      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating: rating || null,
          comment: comment.trim() || null,
          email: email.trim() || null,
          page: pathname,
          // createdAt はDBの now() で十分。送ってもいいけど保存してないなら不要
          // createdAt: new Date().toISOString(),
        }),
      });

      // ✅ ここが重要：500/400でも done にしない
      if (!res.ok) {
        let serverMsg = "";
        try {
          const j = await res.json();
          serverMsg = j?.error ? String(j.error) : "";
        } catch {
          // ignore
        }
        throw new Error(serverMsg || `HTTP_${res.status}`);
      }

      setStatus("done");
      // 送信成功したらフォーム内容をクリア（done表示は残す）
      setRating("");
      setComment("");
      setEmail("");
    } catch (err: any) {
      setStatus("error");
      setErrorMsg(err?.message ? String(err.message) : "送信に失敗しました");
    }
  };

  return (
    <>
      {/* 💬 アイコン */}
      {!open && (
        <button
          onClick={() => {
            setOpen(true);
            // 開いたときに前回エラー等が残ってたら初期化したいなら↓
            // resetForm();
          }}
          className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-sky-500 text-xl text-white shadow-lg transition hover:bg-sky-600"
          aria-label="Feedback"
        >
          💬
        </button>
      )}

      {/* 展開UI */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-96 max-w-[90vw]">
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white/95 p-5 shadow-xl backdrop-blur-md">
            {/* ヘッダー */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Beta</p>
                <p className="font-semibold text-slate-900">フィードバックください🫶</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-slate-600"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {status === "done" ? (
              <div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">
                送信ありがとう！<br />
                改善に活かします✨
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700 hover:bg-slate-50"
                  >
                    閉じる
                  </button>
                  <button
                    type="button"
                    onClick={() => resetForm()}
                    className="rounded-full bg-sky-500 px-3 py-1 text-xs text-white hover:bg-sky-600"
                  >
                    もう一件送る
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3 text-sm">
                {/* エラー */}
                {status === "error" && (
                  <div className="rounded-xl border border-rose-100 bg-rose-50 p-3 text-xs text-rose-700">
                    送信に失敗しました。時間をおいて再度お試しください。
                    {errorMsg ? <div className="mt-1 opacity-80">({errorMsg})</div> : null}
                  </div>
                )}

                {/* 評価 */}
                <div>
                  <p className="mb-1 text-xs text-slate-500">使い心地</p>
                  <div className="flex gap-1">
                    {["1", "2", "3", "4", "5"].map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setRating(v)}
                        disabled={status === "sending"}
                        className={`h-8 w-8 rounded-full border text-xs disabled:opacity-60 ${
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
                  disabled={status === "sending"}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 outline-none focus:ring-2 focus:ring-sky-400 disabled:opacity-60"
                />

                {/* 任意連絡先 */}
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="連絡先（任意）"
                  disabled={status === "sending"}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 outline-none disabled:opacity-60"
                />

                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="w-full rounded-full bg-sky-500 py-2 font-medium text-white hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {status === "sending" ? "送信中..." : "送信する"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
