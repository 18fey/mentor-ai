// app/onboarding/ai-typing/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

import { AITypeIntro } from "@/components/ai-typing/AITypeIntro";
import { AITypeDiagnosis } from "@/components/ai-typing/AITypeDiagnosis";
import { AITypologyResult } from "@/components/ai-typing/AITypologyResult";
import { AITypeKey, aiTypologyTypes } from "@/lib/aiTypologyData";

type Database = any;
type Stage = "intro" | "questions" | "result";

type ProfileRow = {
  id: string;
  ai_type_key: AITypeKey | null;
  ai_type_name: string | null;
};

export default function AIThinkingOnboardingPage() {
  const supabase = createClientComponentClient<Database>();
  const router = useRouter();

  const [checking, setChecking] = useState(true);
  const [stage, setStage] = useState<Stage>("intro");
  const [resultKey, setResultKey] = useState<AITypeKey | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const run = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/auth");
        return;
      }

      try {
        // すでにAIタイプが保存されているかチェック
        const { data: profile, error } = await supabase
          .from("profiles")
          .select("id, ai_type_key, ai_type_name")
          .eq("id", user.id)
          .maybeSingle<ProfileRow>();

        if (error) {
          console.error("load profile for ai-typing error:", error);
        }

        if (profile && profile.ai_type_key) {
          // ✅ 既に診断済み → 最初から結果画面へ
          setResultKey(profile.ai_type_key);
          setStage("result");
        } else {
          // 未診断 → イントロから
          setStage("intro");
        }
      } catch (e) {
        console.error("ai-typing init error:", e);
        setStage("intro");
      } finally {
        setChecking(false);
      }
    };

    run();
  }, [supabase, router]);

  const handleSkip = () => {
    router.push("/"); // スキップ → ダッシュボード
  };

  const handleComplete = async (key: AITypeKey) => {
    setSaving(true);
    setResultKey(key);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        await supabase
          .from("profiles")
          .update({
            ai_type_key: key,
            ai_type_name: aiTypologyLabelFor(key),
          })
          .eq("id", user.id);
      }
    } catch (e) {
      console.error("Failed to save ai type", e);
    } finally {
      setSaving(false);
      setStage("result");
    }
  };

  const handleGoDashboard = () => {
    router.push("/");
  };

  const handleRetake = () => {
    // 「もう一度診断する」→ 質問画面に戻す
    setResultKey(null);
    setStage("questions");
  };

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

// DBに日本語名を入れる用のヘルパー
function aiTypologyLabelFor(key: AITypeKey): string {
  return aiTypologyTypes[key]?.nameJa ?? key;
}
