"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// 本番URL（env優先）
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.mentor-ai.net";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${SITE_URL}/auth/update-password`,
    });

    setLoading(false);

    if (error) {
      setError(error.message || "送信に失敗しました。");
      return;
    }

    setSent(true);
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-md items-center px-6 py-10">
      <div className="w-full rounded-3xl border border-white/40 bg-white/60 p-8 shadow-[0_18px_45px_rgba(15,23,42,0.12)] backdrop-blur-[28px]">
        <h1 className="text-xl font-semibold text-slate-900">パスワード再設定</h1>
        <p className="mt-2 text-xs text-slate-600">
          登録メールアドレスに再設定リンクを送ります。
        </p>

        {error && (
          <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-2 text-xs text-rose-700">
            {error}
          </p>
        )}

        {sent ? (
          <div className="mt-6 space-y-4">
            <p className="rounded-2xl bg-sky-50 px-4 py-3 text-xs text-sky-800">
              送信しました。メールをご確認ください。
            </p>
            <Link href="/auth" className="text-sm font-medium text-sky-600 hover:text-sky-700">
              ログイン画面へ戻る
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 space-y-5">
            <div>
              <label className="block text-xs font-medium text-slate-600">メールアドレス</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-900 outline-none ring-0 transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
                placeholder="you@example.com"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 flex w-full items-center justify-center rounded-2xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "送信中..." : "再設定メールを送る"}
            </button>

            <div className="text-center">
              <Link href="/auth" className="text-xs text-slate-500 hover:text-slate-700">
                ログインへ戻る
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
