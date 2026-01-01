// app/api/usage/consume/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Plan = "free" | "pro"; // eliteがあるなら足してOK
type FeatureKey =
  | "case_interview"
  | "case_generate"
  | "fermi_generate"
  | "fermi"
  | "interview_10"
  | "ai_training"
  | "es_correction"
  | "industry_insight"
  | "enterprise_qgen" 
  |  "es_draft";

// ✅ “無料枠”だけ（proは無制限）
const FREE_LIMITS: Record<FeatureKey, number> = {
  case_interview: 3,
  case_generate: 3,
  fermi: 3,
  fermi_generate: 3,
  interview_10: 1,
  ai_training: 3,
  es_correction: 3,
  industry_insight: 3,
  enterprise_qgen: 5,
  es_draft : 0
};

// ✅ 無料枠を超えたら必要な meta（都度課金）
const META_COST: Record<FeatureKey, number> = {
  es_correction: 1,
  fermi: 1,
  interview_10: 2,
  industry_insight: 2,
  case_interview: 1,
  enterprise_qgen: 2,
  ai_training: 1,
  case_generate: 1,
  fermi_generate: 1,
  es_draft: 0
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

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseFromCookies();

    // ✅ auth（cookieセッションで確定）
    const { data: auth, error: authErr } = await supabase.auth.getUser();
    const user = auth?.user ?? null;

    if (authErr || !user?.id) {
      return NextResponse.json(
        { ok: false, error: "unauthorized", message: "ログインが必要です。" },
        { status: 401 }
      );
    }

    const authUserId = user.id;

    const body = await req.json().catch(() => ({}));
    const feature = body.feature as FeatureKey | undefined;

    if (!feature || !(feature in FREE_LIMITS)) {
      return NextResponse.json(
        { ok: false, error: "invalid_request", message: "feature が不正です。" },
        { status: 400 }
      );
    }

    // plan は profiles.auth_user_id で取る（今のあなたの正）
    const { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select("plan")
      .eq("auth_user_id", authUserId)
      .maybeSingle<{ plan: Plan | null }>();

    if (pErr || !profile) {
      console.error("profiles select error:", pErr);
      return NextResponse.json(
        { ok: false, error: "profile_error", message: "profiles の取得に失敗しました。" },
        { status: 500 }
      );
    }

    const plan: Plan = (profile.plan ?? "free") as Plan;

    // ✅ PROは無制限：ログだけ残す
    if (plan === "pro") {
      const { error: logErr } = await supabase.from("usage_logs").insert({
        user_id: authUserId,
        feature,
        used_at: new Date().toISOString(),
      });

      if (logErr) {
        console.error("usage_logs insert error (pro):", logErr);
        return NextResponse.json(
          { ok: false, error: "insert_failed", message: "利用ログの保存に失敗しました。" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        ok: true,
        feature,
        plan,
        mode: "unlimited",
        chargedMeta: 0,
      });
    }

    // ✅ FREE: 今月の無料枠カウント
    const freeLimit = FREE_LIMITS[feature];
    const startISO = monthStartISO(new Date());

    const { count, error: countErr } = await supabase
      .from("usage_logs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", authUserId)
      .eq("feature", feature)
      .gte("used_at", startISO);

    if (countErr) {
      console.error("usage_logs count error:", countErr);
      return NextResponse.json(
        { ok: false, error: "count_failed", message: "利用状況の取得に失敗しました。" },
        { status: 500 }
      );
    }

    const usedThisMonth = count ?? 0;

    // ✅ 無料枠内：ログだけ（meta消費なし）
    if (usedThisMonth < freeLimit) {
      const { error: logErr } = await supabase.from("usage_logs").insert({
        user_id: authUserId,
        feature,
        used_at: new Date().toISOString(),
      });

      if (logErr) {
        console.error("usage_logs insert error (free within):", logErr);
        return NextResponse.json(
          { ok: false, error: "insert_failed", message: "利用ログの保存に失敗しました。" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        ok: true,
        feature,
        plan,
        mode: "free",
        usedThisMonth: usedThisMonth + 1,
        freeLimit,
        chargedMeta: 0,
        nextAction: "proceed", // このまま機能実行へ
      });
    }

    // ✅ 無料枠超過：ここでは消費しない。meta消費ルートへ誘導するだけ。
    const cost = META_COST[feature] ?? 1;

    return NextResponse.json(
      {
        ok: false,
        error: "need_meta",
        message: "今月の無料枠を使い切りました。METAを消費して続行できます。",
        feature,
        plan,
        usedThisMonth,
        freeLimit,
        requiredMeta: cost,
        // UI/呼び出し側が迷わないための指示
        nextAction: "consume_meta_then_retry",
      },
      { status: 402 }
    );
  } catch (e) {
    console.error("usage/consume server_error:", e);
    return NextResponse.json(
      { ok: false, error: "server_error", message: "利用制限チェック中にエラーが発生しました。" },
      { status: 500 }
    );
  }
}
