// lib/plan.ts
import { supabaseServer } from "@/lib/supabase-server";

export type Plan = "free" | "pro" | "elite";

// ✅ 利用制限の単位（ここに追加するだけで全APIが型エラーなく増やせる）
export type UsageFeature =
  | "case_generate"
  | "fermi_generate"
  | "case_fermi"
  | "interview"
  | "ai_training";

function isUnlimited(plan: Plan) {
  return plan === "pro" || plan === "elite";
}

export async function getUserPlan(userId: string): Promise<Plan> {
  const { data, error } = await supabaseServer
    .from("profiles")
    .select("plan")
    .eq("id", userId) // ✅ 統一
    .maybeSingle();

  if (error || !data) return "free";

  const p = (data.plan as Plan) ?? "free";
  if (p === "pro" || p === "elite") return p;

  return "free";
}

/**
 * 月単位の利用回数チェック
 */
export async function checkMonthlyLimit(params: {
  userId: string;
  feature: UsageFeature;
  freeLimit: number;
}) {
  const { userId, feature, freeLimit } = params;

  const plan = await getUserPlan(userId);
  if (isUnlimited(plan)) {
    return { allowed: true, plan, remaining: Infinity };
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const { count, error } = await supabaseServer
    .from("usage_logs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("feature", feature)
    .gte("used_at", monthStart.toISOString());

  if (error) {
    console.error("checkMonthlyLimit error", error);
    return { allowed: true, plan, remaining: freeLimit };
  }

  const used = count ?? 0;
  const remaining = Math.max(freeLimit - used, 0);

  return {
    allowed: used < freeLimit,
    plan,
    remaining,
  };
}

/**
 * 利用ログを1件追加
 */
export async function logUsage(userId: string, feature: UsageFeature) {
  const { error } = await supabaseServer
    .from("usage_logs")
    .insert({ user_id: userId, feature });

  if (error) console.error("logUsage error", error);
}

export async function requirePro(userId: string) {
  const plan = await getUserPlan(userId);
  const ok = plan === "pro" || plan === "elite";
  return { ok, plan };
}
