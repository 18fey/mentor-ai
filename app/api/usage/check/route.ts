// app/api/usage/check/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Plan = "free" | "pro" | "elite";
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
  | "es_draft";

// ✅ “無料枠”だけ（pro/elite は無制限）
const FREE_LIMITS: Record<FeatureKey, number> = {
  case_interview: 3,
  case_generate: 3,
  fermi: 3,
  fermi_generate: 5,
  interview_10: 1,
  ai_training: 3,
  es_correction: 3,
  industry_insight: 3,
  enterprise_qgen: 5,
  es_draft: 0,
};

// ✅ 無料枠超過時の meta コスト（都度課金）
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
  es_draft: 1,
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

function reqId() {
  return Math.random().toString(36).slice(2, 10);
}

export async function POST(req: NextRequest) {
  const rid = reqId();

  try {
    const supabase = await createSupabaseFromCookies();

    // ✅ auth
    const { data: auth, error: authErr } = await supabase.auth.getUser();
    const user = auth?.user ?? null;

    console.log(`[usage/check:${rid}] auth`, {
      ok: !!user?.id && !authErr,
      authErr: authErr?.message ?? null,
      userId: user?.id ?? null,
    });

    if (authErr || !user?.id) {
      return NextResponse.json(
        { ok: false, error: "unauthorized", message: "ログインが必要です。" },
        { status: 401 }
      );
    }

    const authUserId = user.id;

    const body = await req.json().catch(() => ({}));
    const feature = body.feature as FeatureKey | undefined;

    console.log(`[usage/check:${rid}] request`, { feature });

    if (!feature || !(feature in FREE_LIMITS)) {
      return NextResponse.json(
        { ok: false, error: "invalid_request", message: "feature が不正です。" },
        { status: 400 }
      );
    }

    // ✅ profiles を id で取る（統一）
    let { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select("id, plan")
      .eq("id", authUserId)
      .maybeSingle<{ id: string; plan: Plan | null }>();

    console.log(`[usage/check:${rid}] profiles(select by id)`, {
      found: !!profile,
      pErr: pErr?.message ?? null,
      profile: profile ? { id: profile.id, plan: profile.plan } : null,
    });

    if (pErr) {
      return NextResponse.json(
        { ok: false, error: "profile_error", message: "profiles の取得に失敗しました。" },
        { status: 500 }
      );
    }

    // ✅ 無ければ作る（止血）
    if (!profile) {
      console.warn(`[usage/check:${rid}] profiles missing -> create minimal row`);

      const { error: insErr } = await supabase.from("profiles").insert({
        id: authUserId,
        auth_user_id: authUserId,
        plan: "free",
        onboarding_completed: false,
      });

      if (insErr) {
        console.error(`[usage/check:${rid}] profiles insert failed`, insErr);
        return NextResponse.json(
          { ok: false, error: "profile_create_failed", message: "profiles の作成に失敗しました。" },
          { status: 500 }
        );
      }

      const { data: prof2, error: p2Err } = await supabase
        .from("profiles")
        .select("id, plan")
        .eq("id", authUserId)
        .maybeSingle<{ id: string; plan: Plan | null }>();

      console.log(`[usage/check:${rid}] profiles reloaded`, {
        p2Err: p2Err?.message ?? null,
        prof2,
      });

      if (p2Err || !prof2) {
        return NextResponse.json(
          { ok: false, error: "profile_error", message: "profiles の取得に失敗しました。" },
          { status: 500 }
        );
      }

      profile = prof2;
    }

    const plan: Plan = (profile.plan ?? "free") as Plan;

    // ✅ Pro/Elite は無制限（ここではログも切らない）
    if (plan === "pro" || plan === "elite") {
      return NextResponse.json({
        ok: true,
        feature,
        plan,
        mode: "unlimited",
        proceed: true,
        chargedMeta: 0,
      });
    }

    // ✅ Free：今月の使用回数だけチェック（ログは切らない）
    const freeLimit = FREE_LIMITS[feature];
    const startISO = monthStartISO(new Date());

    const { count, error: countErr } = await supabase
      .from("usage_logs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", authUserId)
      .eq("feature", feature)
      .gte("used_at", startISO);

    if (countErr) {
      console.error(`[usage/check:${rid}] usage_logs count error:`, countErr);
      return NextResponse.json(
        { ok: false, error: "count_failed", message: "利用状況の取得に失敗しました。" },
        { status: 500 }
      );
    }

    const usedThisMonth = count ?? 0;

    // ✅ 無料枠内
    if (usedThisMonth < freeLimit) {
      return NextResponse.json({
        ok: true,
        feature,
        plan,
        mode: "free",
        proceed: true,
        usedThisMonth,
        freeLimit,
        remaining: Math.max(freeLimit - usedThisMonth, 0),
        chargedMeta: 0,
      });
    }

    // ✅ 無料枠超過：meta が必要（ここでは消費しない）
    const requiredMeta = META_COST[feature] ?? 1;

    return NextResponse.json(
      {
        ok: false,
        error: "need_meta",
        message: "今月の無料枠を使い切りました。METAを消費して続行できます。",
        feature,
        plan,
        mode: "need_meta",
        proceed: false,
        usedThisMonth,
        freeLimit,
        requiredMeta,
      },
      { status: 402 }
    );
  } catch (e: any) {
    console.error(`[usage/check:${rid}] server_error:`, e);
    return NextResponse.json(
      { ok: false, error: "server_error", message: "利用状況チェック中にエラーが発生しました。" },
      { status: 500 }
    );
  }
}
