// lib/payment/featureGate.ts
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export type FeatureName =
  | "diagnosis_16type_deep"
  | "career_gap_deep"
  | "es_deep"
  | "interview_deep";

type PlanName = "free" | "pro" | "elite" | string;

type FeatureGateOk = {
  ok: true;
  status: 200;
  userId: string;
  plan: PlanName;
  metaBalance: number;
};

type FeatureGateFail = {
  ok: false;
  status: 401 | 402;
  reason: "unauthorized" | "payment_required";
};

export type FeatureGateResult = FeatureGateOk | FeatureGateFail;

/* --------------------------------
   v8 Supabase Server Client Helper
----------------------------------- */
async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        // 今回は read-only でOKなので set/remove は no-op にしておく
        set() {},
        remove() {},
      },
    }
  );
}

function shouldConsumeMeta(feature: FeatureName) {
  switch (feature) {
    case "diagnosis_16type_deep":
    case "career_gap_deep":
    case "es_deep":
    case "interview_deep":
      return true;
    default:
      return false;
  }
}

function isPlanUnlimited(plan: PlanName) {
  return plan === "pro" || plan === "elite";
}

/**
 * Deep 機能を利用できるかチェックする（Meta消費前）
 */
export async function requirePaidFeature(
  feature: FeatureName
): Promise<FeatureGateResult> {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error("featureGate auth error:", authError);
    return { ok: false, status: 401, reason: "unauthorized" };
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("plan, meta_balance")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("featureGate profile error:", error);
  }

  const plan: PlanName = (profile?.plan as PlanName) ?? "free";
  const metaBalance: number = profile?.meta_balance ?? 0;

  const unlockedByPlan = isPlanUnlimited(plan);
  const unlockedByMeta = metaBalance > 0;

  const isUnlocked = unlockedByPlan || unlockedByMeta;

  if (!isUnlocked) {
    return { ok: false, status: 402, reason: "payment_required" };
  }

  return {
    ok: true,
    status: 200,
    userId: user.id,
    plan,
    metaBalance,
  };
}

/**
 * Metaコインを指定量消費する（planがUnlimitedのときは何もしない）
 */
export async function consumeMeta(
  userId: string,
  amount: number
): Promise<boolean> {
  if (amount <= 0) return true;

  const supabase = await createSupabaseServerClient();

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("meta_balance")
    .eq("id", userId)
    .maybeSingle();

  if (error || !profile) {
    console.error("consumeMeta profile error:", error);
    return false;
  }

  const current = profile.meta_balance ?? 0;
  if (current < amount) {
    console.warn("consumeMeta: insufficient balance");
    return false;
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ meta_balance: current - amount })
    .eq("id", userId);

  if (updateError) {
    console.error("consumeMeta update error:", updateError);
    return false;
  }

  return true;
}

/**
 * Deep機能共通ユーティリティ
 * - Pro/Eliteなら Meta消費なしでOK
 * - Freeで Meta残高があれば amount 分だけ消費
 */
export async function requireAndConsumeMetaIfNeeded(
  feature: FeatureName,
  metaCost = 1
): Promise<FeatureGateResult> {
  const gate = await requirePaidFeature(feature);

  if (!gate.ok) return gate;

  if (isPlanUnlimited(gate.plan)) {
    // Pro/Elite は Meta を減らさない
    return gate;
  }

  if (shouldConsumeMeta(feature)) {
    const ok = await consumeMeta(gate.userId, metaCost);
    if (!ok) {
      return {
        ok: false,
        status: 402,
        reason: "payment_required",
      };
    }
  }

  return gate;
}
