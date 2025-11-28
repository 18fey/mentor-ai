// app/auth/email-sent/page.tsx
"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

export default function EmailSentPage() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const supabase = createClientComponentClient();
  const router = useRouter();

  const handleResend = async () => {
    if (!email) {
      setMessage("メールアドレス情報が見つかりません。もう一度新規登録をお試しください。");
      return;
    }
    setLoading(true);
    setMessage(null);

    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
    });

    setLoading(false);

    if (error) {
      setMessage(error.message || "メールの再送信に失敗しました。時間をおいて再度お試しください。");
    } else {
      setMessage("確認メールを再送信しました。メールボックスをご確認ください。");
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#F5FAFF] to-white px-4">
      <div className="w-full max-w-md rounded-3xl border border-white/40 bg-white/70 p-8 text-center shadow-[0_18px_45px_rgba(15,23,42,0.12)] backdrop-blur-[30px]">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-sky-100 text-sky-600">
          ✉️
        </div>

        <h1 className="mb-2 text-lg font-semibold text-slate-900">
          確認メールを送信しました
        </h1>

        <p className="mb-4 text-sm leading-relaxed text-slate-600">
          {email && (
            <>
              <span className="font-medium">{email}</span>
              <br />
            </>
          )}
          ご登録のメールアドレスに確認リンクを送信しました。
          メール内のリンクをクリックして、Mentor.AI を開始してください。
        </p>

        {message && (
          <p className="mb-3 text-xs text-sky-700">{message}</p>
        )}

        <div className="mt-4 flex flex-col gap-3 text-sm">
          <button
            onClick={handleResend}
            disabled={loading}
            className="w-full rounded-2xl bg-sky-500 px-4 py-2 font-semibold text-white shadow-sm transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "再送信中..." : "メールを再送信"}
          </button>
          <button
            onClick={() => router.push("/")}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 font-medium text-slate-700 transition hover:bg-slate-50"
          >
            トップに戻る
          </button>
        </div>

        <div className="mt-6 text-xs text-slate-500">
          誤って登録してしまった場合は{" "}
          <Link href="/auth" className="text-sky-600 hover:text-sky-700">
            ログイン画面に戻る
          </Link>
          からやり直すことができます。
        </div>

        <div className="mt-4 flex items-center justify-center gap-2 text-[11px] text-slate-400">
          <span>登録</span>
          <span>→</span>
          <span className="font-medium text-sky-600">確認</span>
          <span>→</span>
          <span>完了</span>
        </div>
      </div>
    </main>
  );
}
