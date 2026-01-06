// app/api/usage/summary/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Plan = "free" | "pro";
type FeatureKey =
  | "case_interview"
  | "fermi"
  | "interview_10"
  | "ai_training"
  | "es_correction"
  | "industry_insight"

const FREE_LIMITS: Record<FeatureKey, number> = {
  case_interview: 3,
  fermi: 3,
  interview_10: 1,
  ai_training: 3,
  es_correction: 3,
  industry_insight: 3,
};

const FEATURE_UI: Record<FeatureKey, { label: string; emoji?: string }> = {
  interview_10: { label: "一般面接（10問）", emoji: "🎤" },
  es_correction: { label: "ES添削", emoji: "✅" },
  case_interview: { label: "ケース面接", emoji: "🧩" },
  fermi: { label: "フェルミ推定", emoji: "📏" },
  ai_training: { label: "AI思考力トレーニング", emoji: "🧠" },
  industry_insight: { label: "業界インサイト", emoji: "📚" },
};

function monthStartISO(now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth(), 1);
  return d.toISOString();
}

async function createSupabaseFromCookies() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          cookieStore.set({ name, value: "", ...options });
        },
      },
    }
  );
}

export async function GET() {
  try {
    const supabase = await createSupabaseFromCookies();

    const { data: auth, error: authErr } = await supabase.auth.getUser();
    const user = auth?.user ?? null;

    if (authErr || !user?.id) {
      return NextResponse.json(
        { ok: false, error: "unauthorized", message: "ログインが必要です。" },
        { status: 401 }
      );
    }

    const authUserId = user.id;

    const { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select("plan")
      .eq("auth_user_id", authUserId)
      .maybeSingle<{ plan: Plan | null }>();

    if (pErr || !profile) {
      return NextResponse.json(
        { ok: false, error: "profile_error", message: "profiles の取得に失敗しました。" },
        { status: 500 }
      );
    }

    const plan: Plan = (profile.plan ?? "free") as Plan;
    const startISO = monthStartISO(new Date());

    if (plan === "pro") {
      const items = (Object.keys(FREE_LIMITS) as FeatureKey[]).map((feature) => ({
        feature,
        label: FEATURE_UI[feature]?.label ?? feature,
        emoji: FEATURE_UI[feature]?.emoji,
        usedThisMonth: 0,
        freeLimit: 0,
        remaining: 9999,
      }));

      return NextResponse.json({
        ok: true,
        plan,
        monthStartISO: startISO,
        items,
      });
    }

    // ✅ FREE: 今月の usage_logs をまとめて取ってJSで集計（手軽・確実）
    const { data: rows, error: uErr } = await supabase
      .from("usage_logs")
      .select("feature, used_at")
      .eq("user_id", authUserId)
      .gte("used_at", startISO);

    if (uErr) {
      return NextResponse.json(
        { ok: false, error: "usage_fetch_failed", message: "利用状況の取得に失敗しました。" },
        { status: 500 }
      );
    }

    const counts: Record<string, number> = {};
    for (const r of rows ?? []) {
      const f = (r as any).feature as string | undefined;
      if (!f) continue;
      counts[f] = (counts[f] ?? 0) + 1;
    }

    const items = (Object.keys(FREE_LIMITS) as FeatureKey[]).map((feature) => {
      const freeLimit = FREE_LIMITS[feature];
      const usedThisMonth = counts[feature] ?? 0;
      const remaining = Math.max(0, freeLimit - usedThisMonth);

      return {
        feature,
        label: FEATURE_UI[feature]?.label ?? feature,
        emoji: FEATURE_UI[feature]?.emoji,
        usedThisMonth,
        freeLimit,
        remaining,
      };
    });

    return NextResponse.json({
      ok: true,
      plan,
      monthStartISO: startISO,
      items,
    });
  } catch (e) {
    console.error("usage/summary server_error:", e);
    return NextResponse.json(
      { ok: false, error: "server_error", message: "利用状況の取得中にエラーが発生しました。" },
      { status: 500 }
    );
  }
}
