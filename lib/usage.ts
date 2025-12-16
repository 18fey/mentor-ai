// lib/usage.ts
import { supabaseServer } from "@/lib/supabase-server";

export type Plan = "free" | "beta" | "pro";
export type FeatureKey =
  | "case_interview"
  | "fermi"
  | "general_interview"
  | "ai_training"
  | "es_correction";

export const FEATURE_LIMITS: Record<
  FeatureKey,
  { free: number; beta: number; pro: number | null }
> = {
  case_interview: { free: 3, beta: 5, pro: null },
  fermi: { free: 3, beta: 5, pro: null },
  general_interview: { free: 1, beta: 3, pro: null },
  ai_training: { free: 1, beta: 3, pro: null },
  es_correction: { free: 1, beta: 3, pro: null },
};

function monthStartISO(now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth(), 1);
  return d.toISOString();
}

// ✅ profiles.id = auth.users.id を前提
export async function getProfileByUserId(userId: string) {
  const { data, error } = await supabaseServer
    .from("profiles")
    .select("id, plan")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return data; // null あり
}

// 🔥 “全員オンボーディングで作ってるはず”問題への対処：存在しなければ作る
export async function ensureProfileExists(userId: string) {
  const existing = await getProfileByUserId(userId);
  if (existing) return existing;

  // 既定planは free（必要なら beta_free などに合わせて）
  const { data, error } = await supabaseServer
    .from("profiles")
    .insert({ id: userId, plan: "free" })
    .select("id, plan")
    .single();

  if (error) throw error;
  return data;
}

export async function consumeFeature(params: {
  userId: string;
  feature: FeatureKey;
}) {
  const { userId, feature } = params;

  const config = FEATURE_LIMITS[feature];
  if (!config) {
    return {
      ok: false as const,
      status: 400 as const,
      error: "unknown_feature",
      message: `未知の機能です: ${feature}`,
    };
  }

  // ✅ ここがミソ：無いなら作る
  const profile = await ensureProfileExists(userId);

  const plan: Plan = (profile.plan as Plan) ?? "free";
  const planLimit = config[plan];

  // pro = 無制限（ログだけ）
  if (plan === "pro" || planLimit === null) {
    const { error } = await supabaseServer
      .from("feature_usage")
      .insert({ profile_id: profile.id, feature });

    if (error) {
      return {
        ok: false as const,
        status: 500 as const,
        error: "insert_failed",
        message: "利用ログの保存に失敗しました。",
      };
    }

    return { ok: true as const, status: 200 as const, plan, feature, usedCount: null, remaining: null, limit: null };
  }

  const startISO = monthStartISO(new Date());

  const { count, error: countErr } = await supabaseServer
    .from("feature_usage")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", profile.id)
    .eq("feature", feature)
    .gte("used_at", startISO);

  if (countErr) {
    return {
      ok: false as const,
      status: 500 as const,
      error: "count_failed",
      message: "利用状況の取得に失敗しました。",
    };
  }

  const usedCount = count ?? 0;

  if (usedCount >= planLimit) {
    return {
      ok: false as const,
      status: 403 as const,
      error: "limit_exceeded",
      message:
        plan === "free"
          ? "この機能の今月の無料利用回数が上限に達しました。PROをご検討ください。"
          : "この機能の今月の利用上限に達しました。",
      plan,
      feature,
      usedCount,
      remaining: 0,
      limit: planLimit,
    };
  }

  const { error: insErr } = await supabaseServer
    .from("feature_usage")
    .insert({ profile_id: profile.id, feature });

  if (insErr) {
    return {
      ok: false as const,
      status: 500 as const,
      error: "insert_failed",
      message: "利用ログの保存に失敗しました。",
    };
  }

  const newUsed = usedCount + 1;
  const remaining = Math.max(planLimit - newUsed, 0);

  return {
    ok: true as const,
    status: 200 as const,
    plan,
    feature,
    usedCount: newUsed,
    remaining,
    limit: planLimit,
  };
}
