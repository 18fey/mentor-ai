// app/auth/page.tsx
"use client";

import { useState, FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

type AuthTab = "login" | "signup";

export default function AuthPage() {
  const [tab, setTab] = useState<AuthTab>("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClientComponentClient();

  // 例えば /auth?mode=signup だったら最初から新規登録タブに
  const mode = searchParams.get("mode");
  if (mode === "signup" && tab !== "signup") {
    setTab("signup");
  }

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = String(formData.get("email") || "");
    const password = String(formData.get("password") || "");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setError(error.message || "ログインに失敗しました。もう一度お試しください。");
      return;
    }

    // ログイン成功 → ダッシュボードへ
    router.push("/");
  };

  const handleSignup = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = String(formData.get("email") || "");
    const password = String(formData.get("password") || "");
    const passwordConfirm = String(formData.get("passwordConfirm") || "");

    if (password !== passwordConfirm) {
      setLoading(false);
      setError("パスワードが一致しません。");
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // SupabaseのAuth設定で許可したURLと合わせてね
        emailRedirectTo: `${location.origin}/`,
      },
    });

    setLoading(false);

    if (error) {
      setError(error.message || "登録に失敗しました。もう一度お試しください。");
      return;
    }

    // ここでメール確認フラグを見て案内画面へ
    if (data.user && !data.user.confirmed_at) {
      router.push(`/auth/email-sent?email=${encodeURIComponent(email)}`);
    } else {
      // まれに即時確認される場合はそのままトップへ
      router.push("/");
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#F5FAFF] to-white">
      <div className="mx-auto flex min-h-screen max-w-6xl items-center px-6 py-10">
        {/* 左カラム：ブランドエリア */}
        <section className="hidden flex-1 flex-col pr-10 md:flex">
          <div className="mb-10">
            <div className="text-xs font-semibold tracking-[0.25em] text-slate-500">
              ELITE CAREER PLATFORM
            </div>
            <div className="mt-2 text-3xl font-semibold text-slate-900">
              Mentor.AI
            </div>
          </div>

          <h1 className="mb-6 text-3xl font-semibold leading-snug text-slate-900">
            AIと一緒に、
            <br />
            あなた専属の就活戦略を。
          </h1>

          <p className="mb-6 max-w-xl text-sm leading-relaxed text-slate-600">
            ケース・フェルミ・一般面接・ES添削・業界研究を一気通貫でサポート。
            あなたのためのAIキャリアダッシュボードです。
          </p>

          <dl className="mt-4 space-y-3 text-sm text-slate-600">
            <div>
              <dt className="font-medium text-slate-900">ユースケース</dt>
              <dd className="mt-1">
                ・面接練習と即時フィードバック
                <br />
                ・思考力の可視化
                <br />
                ・進捗ダッシュボード
              </dd>
            </div>
          </dl>

          <div className="pointer-events-none mt-12 h-40 w-72 rounded-3xl bg-white/40 shadow-[0_18px_45px_rgba(15,23,42,0.12)] backdrop-blur-[30px]" />
        </section>

        {/* 右カラム：認証カード */}
        <section className="flex-1">
          <div className="mx-auto w-full max-w-md rounded-3xl border border-white/40 bg-white/60 p-8 shadow-[0_18px_45px_rgba(15,23,42,0.12)] backdrop-blur-[28px]">
            {/* モバイル用ロゴ */}
            <div className="mb-6 flex items-center justify-between md:hidden">
              <div>
                <div className="text-[10px] font-semibold tracking-[0.25em] text-slate-500">
                  ELITE CAREER PLATFORM
                </div>
                <div className="mt-1 text-xl font-semibold text-slate-900">
                  Mentor.AI
                </div>
              </div>
              <span className="rounded-full bg-sky-100 px-3 py-1 text-[11px] font-medium text-sky-700">
                Beta
              </span>
            </div>

            {/* タブ */}
            <div className="flex rounded-full bg-slate-100 p-1 text-xs font-medium text-slate-500">
              <button
                type="button"
                onClick={() => setTab("login")}
                className={`flex-1 rounded-full px-3 py-2 transition ${
                  tab === "login"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "hover:text-slate-800"
                }`}
              >
                ログイン
              </button>
              <button
                type="button"
                onClick={() => setTab("signup")}
                className={`flex-1 rounded-full px-3 py-2 transition ${
                  tab === "signup"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "hover:text-slate-800"
                }`}
              >
                新規登録
              </button>
            </div>

            {/* エラー表示 */}
            {error && (
              <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-2 text-xs text-rose-700">
                {error}
              </p>
            )}

            {/* フォーム本体 */}
            {tab === "login" ? (
              <LoginForm loading={loading} onSubmit={handleLogin} />
            ) : (
              <SignupForm loading={loading} onSubmit={handleSignup} />
            )}
          </div>

          <div className="mx-auto mt-6 max-w-md text-center text-xs text-slate-500">
            はじめての方は{" "}
            <Link
              href="/guide/first-steps"
              className="font-medium text-sky-600 underline-offset-2 hover:underline"
            >
              使い方ガイド
            </Link>{" "}
            からご覧いただけます。
          </div>
        </section>
      </div>
    </main>
  );
}

type AuthFormProps = {
  loading: boolean;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
};

function LoginForm({ loading, onSubmit }: AuthFormProps) {
  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-5">
      <div>
        <label className="block text-xs font-medium text-slate-600">
          メールアドレス
        </label>
        <input
          type="email"
          name="email"
          required
          className="mt-1 w-full rounded-2xl border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-900 outline-none ring-0 transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
          placeholder="you@example.com"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600">
          パスワード
        </label>
        <input
          type="password"
          name="password"
          required
          className="mt-1 w-full rounded-2xl border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-900 outline-none ring-0 transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
          placeholder="••••••••"
        />
      </div>

      <div className="flex items-center justify-between text-xs">
        <div />
        <Link
          href="/auth/reset-password"
          className="text-sky-600 hover:text-sky-700"
        >
          パスワードをお忘れの方
        </Link>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="mt-2 flex w-full items-center justify-center rounded-2xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "ログイン中..." : "ログイン"}
      </button>

      <p className="pt-2 text-center text-xs text-slate-500">
        アカウントをお持ちでない方は{" "}
        <Link
          href="/auth?mode=signup"
          className="font-medium text-sky-600 hover:text-sky-700"
        >
          新規登録
        </Link>
      </p>
    </form>
  );
}

function SignupForm({ loading, onSubmit }: AuthFormProps) {
  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-5">
      <div>
        <label className="block text-xs font-medium text-slate-600">
          メールアドレス
        </label>
        <input
          type="email"
          name="email"
          required
          className="mt-1 w-full rounded-2xl border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-900 outline-none ring-0 transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
          placeholder="you@example.com"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600">
          パスワード
        </label>
        <input
          type="password"
          name="password"
          required
          minLength={8}
          className="mt-1 w-full rounded-2xl border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-900 outline-none ring-0 transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
          placeholder="8文字以上"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600">
          パスワード確認
        </label>
        <input
          type="password"
          name="passwordConfirm"
          required
          minLength={8}
          className="mt-1 w-full rounded-2xl border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-900 outline-none ring-0 transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
          placeholder="もう一度入力してください"
        />
      </div>

      <label className="flex items-start gap-2 text-[11px] text-slate-500">
        <input
          type="checkbox"
          required
          className="mt-[3px] h-3 w-3 rounded border-slate-300 text-sky-500 focus:ring-sky-400"
        />
        <span>
          <Link
            href="/terms"
            className="font-medium text-sky-600 hover:text-sky-700"
          >
            利用規約
          </Link>
          に同意します
        </span>
      </label>

      <button
        type="submit"
        disabled={loading}
        className="mt-2 flex w-full items-center justify-center rounded-2xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "送信中..." : "アカウントを作成"}
      </button>

      <p className="pt-2 text-center text-xs text-slate-500">
        すでにアカウントをお持ちの方は{" "}
        <Link
          href="/auth"
          className="font-medium text-sky-600 hover:text-sky-700"
        >
          ログイン
        </Link>
      </p>
    </form>
  );
}
