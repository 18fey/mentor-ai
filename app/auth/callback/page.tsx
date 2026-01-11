// app/auth/callback/page.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// localStorage key（AuthInner → callback に橋渡し）
const PENDING_ACCEPT_KEY = "mentorai:pending_accept_terms";

type PendingAcceptTerms = {
  is_adult: boolean;
  terms_version: string;
};

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const run = async () => {
      try {
        // 1) セッション確認（メール認証・ログイン後）
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.user?.id) {
          router.replace("/auth?mode=login");
          return;
        }

        const userId = session.user.id;

        // 2) profiles を取得（同意＆オンボーディング状態も一緒に見る）
        const { data: profile, error: profileErr } = await supabase
          .from("profiles")
          .select("onboarding_completed, agreed_terms, is_adult, terms_version")
          .eq("id", userId)
          .maybeSingle();

        if (profileErr) {
          console.error("[auth/callback] Failed to fetch profile:", profileErr);
          router.replace("/onboarding");
          return;
        }

        // 3) 規約同意・年齢確認が未確定なら、ここで確定保存
        const needsLegal =
          !profile?.agreed_terms || profile?.is_adult !== true || !profile?.terms_version;

        if (needsLegal) {
          // AuthInner が localStorage に入れてくれた情報を読む
          let pending: PendingAcceptTerms | null = null;
          try {
            const raw = localStorage.getItem(PENDING_ACCEPT_KEY);
            pending = raw ? (JSON.parse(raw) as PendingAcceptTerms) : null;
          } catch {
            pending = null;
          }

          if (!pending?.terms_version || typeof pending.is_adult !== "boolean") {
            // pending が無い = UIで同意を取れてない / 途中導線で来た
            // → いったん signup に戻してやり直させる（法律的に安全）
            router.replace("/auth?mode=signup&need_legal=1");
            return;
          }

          const res = await fetch("/api/accept-terms", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(pending),
          });

          if (!res.ok) {
            console.error("[auth/callback] accept-terms failed:", await res.text());
            router.replace("/auth?mode=signup&need_legal=1");
            return;
          }

          // 一回確定したら消す（再送防止）
          localStorage.removeItem(PENDING_ACCEPT_KEY);
        }

        // 4) onboarding 判定 → 遷移
        // ※ ここは “同意確定後” にやるのがポイント
        const onboardingCompleted = profile?.onboarding_completed === true;

        if (!onboardingCompleted) {
          router.replace("/onboarding");
        } else {
          router.replace("/");
        }
      } catch (err) {
        console.error("[auth/callback] error:", err);
        router.replace("/auth?mode=login");
      }
    };

    run();
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6">
      <div className="rounded-3xl bg-slate-900/70 px-6 py-4 text-center text-xs text-slate-100 shadow-[0_18px_45px_rgba(15,23,42,0.5)] backdrop-blur-[26px]">
        <p>アカウント情報を確認しています…</p>
        <p className="mt-1 text-[11px] text-slate-400">
          数秒経っても画面が切り替わらない場合は、このタブを閉じて
          もう一度ログインをお試しください。
        </p>
      </div>
    </main>
  );
}
