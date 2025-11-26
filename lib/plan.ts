// lib/plan.ts
import { supabaseServer } from "@/lib/supabase-server";

export type Plan = "free" | "pro" | "beta";

export async function getUserPlan(userId: string): Promise<Plan> {
  const { data, error } = await supabaseServer
    .from("users_profile")
    .select("plan, beta_user")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) return "free";

  // beta_user は事実上のフル解放扱いにする
  if (data.beta_user) return "beta";
  if (data.plan === "pro") return "pro";

  return "free";
}

/**
 * 月単位の利用回数チェック
 */
export async function checkMonthlyLimit(params: {
  userId: string;
  feature: "case_fermi" | "interview";
  freeLimit: number; // free の上限
}) {
  const { userId, feature, freeLimit } = params;

  const plan = await getUserPlan(userId);
  if (plan === "pro" || plan === "beta") {
    // PRO / βユーザーは無制限
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
export async function logUsage(userId: string, feature: string) {
  const { error } = await supabaseServer
    .from("usage_logs")
    .insert({ user_id: userId, feature });

  if (error) console.error("logUsage error", error);
}
