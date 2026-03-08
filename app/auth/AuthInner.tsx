"use client";

import { useEffect, useMemo, useState, FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";

type AuthTab = "login" | "signup";

// 本番URL（env があればそっち優先）
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.mentor-ai.net";

// Termsバージョン & localStorage key
const TERMS_VERSION = "2025-12-02";
const PENDING_ACCEPT_KEY = "mentorai:pending_accept_terms";

// クライアント用 Supabase インスタンス
const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function sanitizeNext(raw: string | null): string {
  if (!raw) return "/";
  if (!raw.startsWith("/")) return "/";
  if (raw.startsWith("//")) return "/";
  if (raw.startsWith("/auth")) return "/";
  return raw;
}

export function AuthInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const nextPath = useMemo(
    () => sanitizeNext(searchParams.get("redirectedFrom") || searchParams.get("next")),
    [searchParams]
  );

  const [tab, setTab] = useState<AuthTab>(
    searchParams.get("mode") === "signup" ? "signup" : "login"
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);

  useEffect(() => {
    setTab(searchParams.get("mode") === "signup" ? "signup" : "login");
  }, [searchParams]);

  useEffect(() => {
    const urlError = searchParams.get("error");
    const errorCode = searchParams.get("error_code");
    const errorDescription = searchParams.get("error_description");

    if (errorCode === "otp_expired") {
      setError(
        "メールの認証リンクの有効期限が切れています。お手数ですが、もう一度ログインまたは新規登録からメールを受け取り直してください。"
      );
      setTab("login");
      return;
    }

    if (urlError) {
      const desc = errorDescription
        ? decodeURIComponent(errorDescription.replace(/\+/g, " "))
        : "認証に失敗しました。もう一度お試しください。";
      setError(desc);
    }
  }, [searchParams]);

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

    window.location.replace(`/auth/callback?next=${encodeURIComponent(nextPath)}`);
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
        emailRedirectTo: `${SITE_URL}/auth/callback?next=${encodeURIComponent(nextPath)}`,
      },
    });

    setLoading(false);

    if (error) {
      if (error.message?.toLowerCase().includes("already registered")) {
        setError("このメールアドレスはすでに登録されています。ログインからお進みください。");
        setTab("login");
      } else {
        setError(error.message || "登録に失敗しました。もう一度お試しください。");
      }
      return;
    }

    if (data.user && !data.user.confirmed_at) {
      router.push(`/auth/email-sent?email=${encodeURIComponent(email)}`);
    } else {
      window.location.replace(`/auth/callback?next=${encodeURIComponent(nextPath)}`);
    }
  };

  return (
    <>
      <div className="mx-auto flex min-h-screen max-w-6xl items-center px-6 py-10">
        <section className="hidden flex-1 flex-col pr-10 md:flex">
          <div className="mb-10">
            <div className="text-xs font-semibold tracking-[0.25em] text-slate-500">
              ⚠️何度もログイン画面に戻ってしまう方はリロードをお願いします。（⌘+R）
            </div>
            <div className="text-xs font-semibold tracking-[0.25em] text-slate-500">
              ELITE CAREER PLATFORM
            </div>
            <div className="mt-2 text-3xl font-semibold text-slate-900">Mentor.AI</div>
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

        <section className="flex-1">
          <div className="mx-auto w-full max-w-md rounded-3xl border border-white/40 bg-white/60 p-8 shadow-[0_18px_45px_rgba(15,23,42,0.12)] backdrop-blur-[28px]">
            <div className="mb-6 flex items-center justify-between md:hidden">
              <div>
                <div className="text-[10px] font-semibold tracking-[0.25em] text-slate-500">
                  ELITE CAREER PLATFORM
                </div>
                <div className="mt-1 text-xl font-semibold text-slate-900">Mentor.AI</div>
              </div>
              <span className="rounded-full bg-sky-100 px-3 py-1 text-[11px] font-medium text-sky-700">
                Beta
              </span>
            </div>

            <div className="flex rounded-full bg-slate-100 p-1 text-xs font-medium text-slate-500">
              <button
                type="button"
                onClick={() => setTab("login")}
                className={`flex-1 rounded-full px-3 py-2 transition ${
                  tab === "login" ? "bg-white text-slate-900 shadow-sm" : "hover:text-slate-800"
                }`}
              >
                ログイン
              </button>
              <button
                type="button"
                onClick={() => setTab("signup")}
                className={`flex-1 rounded-full px-3 py-2 transition ${
                  tab === "signup" ? "bg-white text-slate-900 shadow-sm" : "hover:text-slate-800"
                }`}
              >
                新規登録
              </button>
            </div>

            {error && (
              <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-2 text-xs text-rose-700">
                {error}
              </p>
            )}

            {tab === "login" ? (
              <LoginForm loading={loading} onSubmit={handleLogin} />
            ) : (
              <SignupForm
                loading={loading}
                onSubmit={handleSignup}
                onOpenTerms={() => setShowTerms(true)}
                onOpenPrivacy={() => setShowPrivacy(true)}
              />
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

      {showTerms && (
        <LegalModal
          title="利用規約"
          body={TERMS_TEXT}
          onClose={() => setShowTerms(false)}
          linkHref="/terms"
          linkLabel=""
        />
      )}

      {showPrivacy && (
        <LegalModal
          title="プライバシーポリシー"
          body={PRIVACY_TEXT}
          onClose={() => setShowPrivacy(false)}
          linkHref="/privacy"
          linkLabel=""
        />
      )}
    </>
  );
}

type AuthFormProps = {
  loading: boolean;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
};

type SignupFormProps = AuthFormProps & {
  onOpenTerms: () => void;
  onOpenPrivacy: () => void;
};

function LoginForm({ loading, onSubmit }: AuthFormProps) {
  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-5">
      <div>
        <label className="block text-xs font-medium text-slate-600">メールアドレス</label>
        <input
          type="email"
          name="email"
          required
          className="mt-1 w-full rounded-2xl border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-900 outline-none ring-0 transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
          placeholder="you@example.com"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600">パスワード</label>
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
        <Link href="/auth/reset-password" className="text-sky-600 hover:text-sky-700">
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
        <Link href="/auth?mode=signup" className="font-medium text-sky-600 hover:text-sky-700">
          新規登録
        </Link>
      </p>
    </form>
  );
}

function SignupForm({ loading, onSubmit, onOpenTerms, onOpenPrivacy }: SignupFormProps) {
  const [isAdult, setIsAdult] = useState(false);
  const [agreedTerms, setAgreedTerms] = useState(false);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!isAdult || !agreedTerms) return;

    try {
      localStorage.setItem(
        PENDING_ACCEPT_KEY,
        JSON.stringify({
          is_adult: isAdult,
          terms_version: TERMS_VERSION,
          agreed_terms: true,
        })
      );
    } catch {
      // localStorageが使えない環境でも submit は止めない
    }

    onSubmit(e);
  };

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-5">
      <div>
        <label className="block text-xs font-medium text-slate-600">メールアドレス</label>
        <input
          type="email"
          name="email"
          required
          className="mt-1 w-full rounded-2xl border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-900 outline-none ring-0 transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
          placeholder="you@example.com"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600">パスワード</label>
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
        <label className="block text-xs font-medium text-slate-600">パスワード確認</label>
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
          name="isAdult"
          required
          checked={isAdult}
          onChange={(e) => setIsAdult(e.target.checked)}
          className="mt-[3px] h-3 w-3 rounded border-slate-300 text-sky-500 focus:ring-sky-400"
        />
        <span>私は18歳以上です</span>
      </label>

      <label className="flex items-start gap-2 text-[11px] text-slate-500">
        <input
          type="checkbox"
          name="agreedTerms"
          required
          checked={agreedTerms}
          onChange={(e) => setAgreedTerms(e.target.checked)}
          className="mt-[3px] h-3 w-3 rounded border-slate-300 text-sky-500 focus:ring-sky-400"
        />
        <span>
          <button
            type="button"
            onClick={onOpenTerms}
            className="font-medium text-sky-600 hover:text-sky-700 underline-offset-2 hover:underline"
          >
            利用規約
          </button>
          と{" "}
          <button
            type="button"
            onClick={onOpenPrivacy}
            className="font-medium text-sky-600 hover:text-sky-700 underline-offset-2 hover:underline"
          >
            プライバシーポリシー
          </button>
          に同意します
        </span>
      </label>

      <button
        type="submit"
        disabled={loading || !isAdult || !agreedTerms}
        className="mt-2 flex w-full items-center justify-center rounded-2xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "送信中..." : "アカウントを作成"}
      </button>

      <p className="pt-2 text-center text-xs text-slate-500">
        すでにアカウントをお持ちの方は{" "}
        <Link href="/auth" className="font-medium text-sky-600 hover:text-sky-700">
          ログイン
        </Link>
      </p>
    </form>
  );
}

type LegalModalProps = {
  title: string;
  body: string;
  onClose: () => void;
  linkHref: string;
  linkLabel: string;
};

function LegalModal({ title, body, onClose, linkHref, linkLabel }: LegalModalProps) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-3xl rounded-3xl bg-white p-6 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-slate-400 hover:text-slate-600"
          >
            ✕
          </button>
        </div>

        <p className="mb-3 text-xs text-slate-500">
          {title}の全文です。スクロールして内容をご確認いただけます。
        </p>

        <div className="mb-4 max-h-[60vh] overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-[11px] leading-relaxed text-slate-700 whitespace-pre-wrap">
          {body}
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-500">
          <Link
            href={linkHref}
            target="_blank"
            className="font-medium text-sky-600 hover:text-sky-700 underline-offset-2 hover:underline"
          >
            {linkLabel}
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 px-4 py-1 text-[11px] text-slate-600 hover:bg-slate-50"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}

// ここは元ファイルの定数をそのまま残してOK
const TERMS_TEXT: string = `
Mentor.AI 利用規約
制定日：2025年11月25日
最終更新日：2025年12月10日（ドラフト）
...
`;

const PRIVACY_TEXT: string = `
Mentor.AI プライバシーポリシー
制定日：2025年11月25日
最終更新日：2025年12月10日（ドラフト）
...
`;