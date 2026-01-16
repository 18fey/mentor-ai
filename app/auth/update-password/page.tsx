"use client";

import { useState, FormEvent, useEffect } from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // セッションがないと叩けないケースがあるので、軽く確認（なくてもUIは出す）
  useEffect(() => {
    supabase.auth.getSession();
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("パスワードは8文字以上にしてください。");
      return;
    }
    if (password !== passwordConfirm) {
      setError("パスワードが一致しません。");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setError(error.message || "更新に失敗しました。");
      return;
    }

    setDone(true);
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-md items-center px-6 py-10">
      <div className="w-full rounded-3xl border border-white/40 bg-white/60 p-8 shadow-[0_18px_45px_rgba(15,23,42,0.12)] backdrop-blur-[28px]">
        <h1 className="text-xl font-semibold text-slate-900">新しいパスワードを設定</h1>

        {error && (
          <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-2 text-xs text-rose-700">
            {error}
          </p>
        )}

        {done ? (
          <div className="mt-6 space-y-4">
            <p className="rounded-2xl bg-sky-50 px-4 py-3 text-xs text-sky-800">
              パスワードを更新しました。ログインしてください。
            </p>
            <Link href="/auth" className="text-sm font-medium text-sky-600 hover:text-sky-700">
              ログイン画面へ
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 space-y-5">
            <div>
              <label className="block text-xs font-medium text-slate-600">新しいパスワード</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-900 outline-none ring-0 transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
                placeholder="8文字以上"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600">確認</label>
              <input
                type="password"
                required
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-900 outline-none ring-0 transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
                placeholder="もう一度入力"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 flex w-full items-center justify-center rounded-2xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "更新中..." : "パスワードを更新"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
