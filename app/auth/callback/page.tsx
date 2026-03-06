// app/auth/callback/page.tsx
"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

// localStorage key（AuthInner → callback に橋渡し）
const PENDING_ACCEPT_KEY = "mentorai:pending_accept_terms";

type PendingAcceptTerms = {
  is_adult: boolean;
  terms_version: string;
};

export default function AuthCallbackPage() {
  const router = useRouter();
  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  useEffect(() => {
    const run = async () => {
      try {
        // 1) getUser() でセッション確認（getSession() より確実：サーバー側でJWT検証）
        const {
          data: { user },
          error: userErr,
        } = await supabase.auth.getUser();

        if (userErr || !user?.id) {
          router.replace(“/auth?mode=login”);
          return;
        }

        const userId = user.id;

        // 2) profiles を取得（proxy.ts の LEGAL GATE と同じ5列を確認）
        const { data: profile, error: profileErr } = await supabase
          .from(“profiles”)
          .select(“onboarding_completed, agreed_terms, agreed_terms_at, is_adult, is_adult_at, terms_version”)
          .eq(“id”, userId)
          .maybeSingle();

        if (profileErr) {
          console.error(“[auth/callback] Failed to fetch profile:”, profileErr);
          router.replace(“/onboarding”);
          return;
        }

        // 3) legalOk チェック（proxy.ts の LEGAL GATE と同じ5列で統一）
        const legalOk =
          profile?.agreed_terms === true &&
          profile?.is_adult === true &&
          !!profile?.agreed_terms_at &&
          !!profile?.is_adult_at &&
          !!profile?.terms_version;

        if (!legalOk) {
          const next = profile?.onboarding_completed ? “/” : “/onboarding”;

          // signup フロー: localStorage に pending があれば /api/accept-terms で確定
          let pending: PendingAcceptTerms | null = null;
          try {
            const raw = localStorage.getItem(PENDING_ACCEPT_KEY);
            pending = raw ? (JSON.parse(raw) as PendingAcceptTerms) : null;
          } catch {
            pending = null;
          }

          if (pending?.terms_version && typeof pending.is_adult === “boolean”) {
            // signup フロー: フォームで同意済みの pending を確定保存
            const res = await fetch(“/api/accept-terms”, {
              method: “POST”,
              headers: { “Content-Type”: “application/json” },
              body: JSON.stringify(pending),
            });

            if (!res.ok) {
              console.error(“[auth/callback] accept-terms failed:”, await res.text());
              router.replace(`/legal/confirm?next=${encodeURIComponent(next)}`);
              return;
            }

            localStorage.removeItem(PENDING_ACCEPT_KEY);
            // fall through to onboarding check
          } else {
            // login フロー（pending なし）: /legal/confirm に誘導してUIで同意取得
            router.replace(`/legal/confirm?next=${encodeURIComponent(next)}`);
            return;
          }
        }

        // 4) onboarding 判定 → 遷移
        if (!profile?.onboarding_completed) {
          router.replace(“/onboarding”);
        } else {
          router.replace(“/”);
        }
      } catch (err) {
        console.error(“[auth/callback] error:”, err);
        router.replace(“/auth?mode=login”);
      }
    };

    run();
  }, [router, supabase]);

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
