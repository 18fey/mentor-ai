// components/ai-typing/AITypologyResult.tsx
"use client";

import { useEffect, useRef } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import { AITypeKey, aiTypologyTypes } from "@/lib/aiTypologyData";

type Props = {
  resultKey: AITypeKey;
  onGoDashboard?: () => void; // ← 任意に変更
  onRetake: () => void;
};

function createClientSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export function AITypologyResult({
  resultKey,
  onGoDashboard,
  onRetake,
}: Props) {
  const t = aiTypologyTypes[resultKey];

  // Router
  const router = useRouter();

  // Supabase クライアント
  const supabase = createClientSupabase();

  // 二重保存防止用フラグ
  const hasSavedRef = useRef(false);

  useEffect(() => {
    // すでに保存済みなら何もしない
    if (hasSavedRef.current) return;

    const saveResult = async () => {
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
          console.error("Failed to get user:", userError);
          return;
        }
        if (!user) {
          console.warn("No authenticated user. Skip saving AI typology.");
          return;
        }

        const { error } = await supabase
          .from("profiles")
          .update({
            ai_type_key: resultKey,
            ai_typology_completed: true,
            ai_type_version: 1,
          })
          .eq("id", user.id);

        if (error) {
          console.error("Failed to save AI typology result:", error);
          return;
        }

        hasSavedRef.current = true;
      } catch (e) {
        console.error("Unexpected error while saving AI typology:", e);
      }
    };

    void saveResult();
  }, [resultKey, supabase]);

  const handleGoDashboard = () => {
    // 親に何かさせたい場合はここで
    if (onGoDashboard) {
      onGoDashboard();
    }
    // /start に遷移
    router.push("/start");
  };

  return (
    <div className="w-full max-w-3xl rounded-3xl border border-white/40 bg-white/80 p-8 shadow-[0_18px_45px_rgba(15,23,42,0.12)] backdrop-blur-[30px]">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-sky-500">
        YOUR AI THINKING TYPE
      </p>
      <h1 className="mb-1 text-xl font-semibold text-slate-900">
        あなたは <span className="text-sky-600">{t.nameJa}</span> タイプです。
      </h1>
      <p className="mb-6 text-xs text-slate-500">{t.catchphrase}</p>

      <div className="grid gap-5 md:grid-cols-2">
        <Section title="あなたの特徴" items={t.features} />
        <Section title="AIとの付き合い方" items={t.aiStyle} />
        <Section title="就活・キャリアでの強み" items={t.strengths} />
        <Section title="注意ポイント" items={t.cautions} tone="warn" />
      </div>

      <div className="mt-6 rounded-2xl bg-sky-50 px-4 py-3 text-xs text-sky-900">
        <p className="mb-1 text-[11px] font-semibold text-sky-700">
          あなた専用の学習ルート
        </p>
        <p>{t.recommendedPath}</p>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={handleGoDashboard}
          className="inline-flex items-center justify-center rounded-full bg-sky-500 px-6 py-2 text-xs font-semibold text-white shadow-sm hover:bg-sky-600"
        >
          あなた専用のダッシュボードを開く →
        </button>

        <button
          type="button"
          onClick={onRetake}
          className="text-[11px] text-slate-400 underline-offset-2 hover:text-slate-600 hover:underline"
        >
          もう一度診断する
        </button>
      </div>
    </div>
  );
}

function Section({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone?: "warn" | "normal";
}) {
  const bulletColor = tone === "warn" ? "bg-rose-300" : "bg-sky-300";

  return (
    <div>
      <h2 className="mb-2 text-xs font-semibold text-slate-800">{title}</h2>
      <ul className="space-y-1.5 text-[11px] text-slate-600">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2">
            <span
              className={`mt-[5px] h-1.5 w-1.5 rounded-full ${bulletColor}`}
            />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
