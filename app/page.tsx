// app/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import Link from "next/link";
import Dashboard from "@/components/Dashboard";

type Database = any; // Supabase 型を定義していれば差し替えOK

export default function HomePage() {
  const supabase = createClientComponentClient<Database>();
  const router = useRouter();

  const [checking, setChecking] = useState(true);   // 認証＆オンボ確認中
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        // 1) ログインユーザー取得
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push("/auth");
          return;
        }

        // 2) profiles のオンボ完了フラグ確認
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("onboarding_completed")
          .eq("id", user.id)
          .maybeSingle();

        if (profileError) {
          console.error(profileError);
          setError("プロフィールの読み込みに失敗しました。");
          setChecking(false);
          return;
        }

        if (!profile || !profile.onboarding_completed) {
          // まだオンボしてなければ /onboarding へ
          router.push("/onboarding");
          return;
        }

        // ここまで来たら通常ダッシュボード表示
        setChecking(false);
      } catch (e) {
        console.error(e);
        setError("読み込み中にエラーが発生しました。");
        setChecking(false);
      }
    };

    run();
  }, [supabase, router]);

  // チェック中のローディング表示
  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="rounded-3xl bg-white/70 px-6 py-4 text-sm text-slate-600 shadow">
          ダッシュボードを準備しています…
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="rounded-3xl bg-rose-50 px-6 py-4 text-sm text-rose-700 shadow">
          {error}
        </div>
      </main>
    );
  }

  // ✅ オンボ完了済みユーザー向けのトップUI
  return (
    <div className="min-h-screen space-y-8">
      {/* 🔵 AIタイプ診断ヒーロー */}
      <section>
        <div className="flex flex-col gap-4 rounded-3xl border border-sky-100 bg-gradient-to-br from-sky-50 via-white to-sky-100/70 p-6 shadow-sm shadow-sky-100 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-sky-500">
              NEW / AI TYPE
            </p>
            <h2 className="text-lg font-semibold text-slate-900">
              AIタイプ診断（16タイプ）
            </h2>
            <p className="text-sm text-slate-600">
              10問の直感アンケートで、あなたの
              <span className="font-semibold">「AIとの付き合い方」</span>
              を分析します。Mentor.AI独自の視点で、仕事でのAI活用スタイルを可視化。
            </p>

            <div className="flex flex-wrap gap-2 text-[11px] text-slate-500">
              <span className="rounded-full bg-white/70 px-2 py-1">
                # 16タイプ診断
              </span>
              <span className="rounded-full bg-white/70 px-2 py-1">
                # 無料
              </span>
              <span className="rounded-full bg-white/70 px-2 py-1">
                # 所要2〜3分
              </span>
            </div>

            <div className="mt-3 flex items-center gap-3">
              {/* ここはあとで /onboarding/ai-typing に変えてもOK */}
              <Link
                href="/diagnosis-16type"
                className="inline-flex items-center rounded-full bg-sky-500 px-5 py-2 text-xs font-medium text-white shadow-sm shadow-sky-200 transition hover:bg-sky-600"
              >
                診断してみる →
              </Link>
              <span className="text-[11px] text-slate-400">
                今の思考パターンを知ろう
              </span>
            </div>
          </div>

          {/* 右側サンプルタイプ */}
          <div className="mt-4 md:mt-0 md:w-52">
            <div className="rounded-2xl bg-white/80 p-4 shadow-sm shadow-sky-100">
              <p className="mb-2 text-[11px] font-semibold text-slate-500">
                診断タイプ例
              </p>
              <div className="mb-2 rounded-xl bg-sky-50/80 px-3 py-2 text-xs text-sky-800">
                <p className="font-semibold">Strategic Co-Pilot</p>
                <p className="text-[11px]">
                  戦略的コ・パイロット型
                  <br />
                  AIを右腕にし、共に成果を出すタイプ。
                </p>
              </div>
              <p className="text-[11px] text-slate-500">
                ほか15タイプからあなたを分析。
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 既存のダッシュボード */}
      <Dashboard />
    </div>
  );
}
// app/page.tsx の一番下あたりに追加
<section className="mt-16 border-t pt-8 text-xs text-slate-600">
  <h2 className="mb-2 font-semibold text-sm">運営者情報</h2>
  <p>事業者名：渡邉 花鈴（屋号：Mentor.AI）</p>
  <p>所在地：〒104-0061 東京都中央区銀座一丁目22番11号 銀座大竹ビジデンス 2F</p>
  <p>お問い合わせ：support@mentor-ai.net</p>
  <p className="mt-2">
    特定商取引法に基づく表記は
    <a href="/legal" className="underline">
      こちら
    </a>
    をご覧ください。
  </p>
</section>
