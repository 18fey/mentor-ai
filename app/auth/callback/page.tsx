"use client";

import { Suspense, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

// localStorage key（AuthInner → callback に橋渡し）
const PENDING_ACCEPT_KEY = "mentorai:pending_accept_terms";

type PendingAcceptTerms = {
  is_adult: boolean;
  terms_version: string;
  agreed_terms: true;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sanitizeNext(raw: string | null): string {
  if (!raw) return "/";
  if (!raw.startsWith("/")) return "/";
  if (raw.startsWith("//")) return "/";
  if (raw.startsWith("/auth")) return "/";
  return raw;
}

function AuthCallbackInner() {
  const searchParams = useSearchParams();

  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  useEffect(() => {
    const redirectTo = (path: string) => {
      window.location.replace(path);
    };

    const run = async () => {
      try {
        const requestedNext = sanitizeNext(searchParams.get("next"));

        let sessionUserId: string | null = null;
        let sessionErr: unknown = null;

        for (let i = 0; i < 6; i++) {
          const {
            data: { session },
            error,
          } = await supabase.auth.getSession();

          sessionErr = error;

          if (session?.user?.id) {
            sessionUserId = session.user.id;
            break;
          }

          await sleep(250);
        }

        if (sessionErr || !sessionUserId) {
          redirectTo("/auth?mode=login");
          return;
        }

        const userId = sessionUserId;

        const { data: profile, error: profileErr } = await supabase
          .from("profiles")
          .select(
            "onboarding_completed, agreed_terms, agreed_terms_at, is_adult, is_adult_at, terms_version"
          )
          .eq("id", userId)
          .maybeSingle();

        if (profileErr) {
          console.error("[auth/callback] Failed to fetch profile:", profileErr);
          redirectTo("/onboarding");
          return;
        }

        const legalOk =
          profile?.agreed_terms === true &&
          profile?.is_adult === true &&
          !!profile?.agreed_terms_at &&
          !!profile?.is_adult_at &&
          !!profile?.terms_version;

        const afterLegalNext = profile?.onboarding_completed ? requestedNext : "/onboarding";

        if (!legalOk) {
          let pending: PendingAcceptTerms | null = null;

          try {
            const raw = localStorage.getItem(PENDING_ACCEPT_KEY);
            pending = raw ? (JSON.parse(raw) as PendingAcceptTerms) : null;
          } catch {
            pending = null;
          }

          if (
            pending?.terms_version &&
            pending?.agreed_terms === true &&
            typeof pending.is_adult === "boolean"
          ) {
            const res = await fetch("/api/accept-terms", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(pending),
            });

            if (!res.ok) {
              console.error("[auth/callback] accept-terms failed:", await res.text());
              redirectTo(`/legal/confirm?next=${encodeURIComponent(afterLegalNext)}`);
              return;
            }

            localStorage.removeItem(PENDING_ACCEPT_KEY);
          } else {
            redirectTo(`/legal/confirm?next=${encodeURIComponent(afterLegalNext)}`);
            return;
          }
        }

        if (!profile?.onboarding_completed) {
          redirectTo("/onboarding");
        } else {
          redirectTo(requestedNext);
        }
      } catch (err) {
        console.error("[auth/callback] error:", err);
        window.location.replace("/auth?mode=login");
      }
    };

    run();
  }, [searchParams, supabase]);

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

function CallbackFallback() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6">
      <div className="rounded-3xl bg-slate-900/70 px-6 py-4 text-center text-xs text-slate-100 shadow-[0_18px_45px_rgba(15,23,42,0.5)] backdrop-blur-[26px]">
        <p>アカウント情報を確認しています…</p>
      </div>
    </main>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<CallbackFallback />}>
      <AuthCallbackInner />
    </Suspense>
  );
}