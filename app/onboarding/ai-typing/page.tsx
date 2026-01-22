"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

import { AITypeIntro } from "@/components/ai-typing/AITypeIntro";
import { AITypeDiagnosis } from "@/components/ai-typing/AITypeDiagnosis";
import { AITypologyResult } from "@/components/ai-typing/AITypologyResult";
import { AITypeKey, aiTypologyTypes } from "@/lib/aiTypologyData";

type Database = any;

type Stage = "intro" | "questions" | "result";

type ProfileRow = {
  id: string;
  ai_type_key: AITypeKey | null;
};

export default function AIThinkingOnboardingPage() {
  const router = useRouter();

  const supabase = useMemo(
    () =>
      createBrowserClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  const [checking, setChecking] = useState(true);
  const [stage, setStage] = useState<Stage>("intro");
  const [resultKey, setResultKey] = useState<AITypeKey | null>(null);
  const [saving, setSaving] = useState(false);

  // -------------------------------
  // 初期ロード：すでに診断済みかチェック
  // -------------------------------
  useEffect(() => {
    const run = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/auth");
        return;
      }

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("id, ai_type_key")
        .eq("id", user.id)
        .maybeSingle<ProfileRow>();

      if (error) {
        console.error("Failed to load profile:", error);
      }

      if (profile?.ai_type_key) {
        // すでに診断済み → 結果画面へ
        setResultKey(profile.ai_type_key);
        setStage("result");
      } else {
        // 未診断 →イントロへ
        setStage("intro");
      }

      setChecking(false);
    };

    run();
  }, [supabase, router]);

  // -------------------------------
  // 診断完了 → 結果保存
  // -------------------------------
  const handleComplete = async (key: AITypeKey) => {
    setSaving(true);
    setResultKey(key);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { error } = await supabase
        .from("profiles")
        .update({ ai_type_key: key })
        .eq("id", user.id);

      if (error) {
        console.error("Failed to save ai_type_key:", error);
      }
    }

    setSaving(false);
    setStage("result");
  };

  // -------------------------------
  // ダッシュボードへ
  // -------------------------------
  const handleGoDashboard = () => {
    router.push("/");
  };

  // -------------------------------
  // 再受験（結果を破棄して質問に戻す）
  // -------------------------------
  const handleRetake = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      // DB の値もリセットしておく
      await supabase
        .from("profiles")
        .update({ ai_type_key: null })
        .eq("id", user.id);
    }

    setResultKey(null);
    setStage("questions");
  };

  const handleSkip = () => router.push("/");

  // -------------------------------
  // ローディング
  // -------------------------------
  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="rounded-3xl bg-white/70 px-6 py-4 text-sm text-slate-600 shadow">
          AIタイプ診断を準備しています…
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      {stage === "intro" && (
        <AITypeIntro
          onStart={() => setStage("questions")}
          onSkip={handleSkip}
        />
      )}

      {stage === "questions" && (
        <AITypeDiagnosis
          onComplete={handleComplete}
          onBackToIntro={() => setStage("intro")}
        />
      )}

      {stage === "result" && resultKey && (
        <AITypologyResult
          resultKey={resultKey}
          onGoDashboard={handleGoDashboard}
          onRetake={handleRetake}
        />
      )}

      {saving && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-slate-900/80 px-4 py-1.5 text-[11px] text-slate-100 shadow-lg">
          診断結果を保存しています…
        </div>
      )}
    </main>
  );
}
