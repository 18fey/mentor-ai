// app/auth/callback/page.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

export default function AuthCallbackPage() {
  const router = useRouter();
  const supabase = createClientComponentClient();

  useEffect(() => {
    const run = async () => {
      try {
        // 1. セッションがあるか確認（メール認証リンクから来たあと）
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          // セッション取れない → 何かおかしいのでログイン画面へ戻す
          router.replace("/auth?mode=login");
          return;
        }

        // 2. プロフィールのオンボーディング状態を確認
        const { data: profile, error } = await supabase
          .from("profiles")
          .select("onboarding_completed")
          .eq("id", session.user.id)
          .maybeSingle();

        if (error) {
          console.error("Failed to fetch profile:", error);
          // プロフィール取得に失敗したら、とりあえずオンボーディングへ
          router.replace("/onboarding");
          return;
        }

        // 3. まだオンボーディングしてなければ /onboarding へ
        if (!profile || !profile.onboarding_completed) {
          router.replace("/onboarding");
        } else {
          // 4. 済んでいればホーム（ダッシュボード）へ
          router.replace("/");
        }
      } catch (err) {
        console.error("Auth callback error:", err);
        router.replace("/auth?mode=login");
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
