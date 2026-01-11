// /featureGate.ts
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export type FeatureId =
  | "es_correction"
  | "fermi"
  | "interview_10"
  | "industry_insight"
  | "case_interview"
  | "enterprise_qgen"
  | "career_gap_deep"
  | "ai_training"
  | "es_draft";

type PlanName = "free" | "pro" | "elite";

export const FEATURE_META_COST: Record<FeatureId, number> = {
  es_correction: 1,
  fermi: 1,
  interview_10: 2,
  industry_insight: 2,
  case_interview: 1,
  enterprise_qgen: 2,
  career_gap_deep: 3,
  ai_training: 1,
  es_draft: 1,
};

export type FeatureGateOk = {
  ok: true;
  status: 200;
  authUserId: string;
  plan: PlanName;
  used: number; // proなら0
  cost: number;
  balance: number; // 常に meta_lots 集計
  isUnlimited: boolean;
};

export type FeatureGateFail = {
  ok: false;
  status: 400 | 401 | 402 | 500;
  reason:
    | "invalid_body"
    | "unknown_feature"
    | "unauthorized"
    | "insufficient_meta"
    | "profile_not_found"
    | "consume_failed";
  required?: number;
};

export type FeatureGateResult = FeatureGateOk | FeatureGateFail;

/* ------------------------------
   v8 Supabase Server Client
------------------------------- */
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

// ✅ Route Handler内だけで使用（絶対にクライアントに渡さない）
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function isUnlimitedPlan(plan: PlanName) {
  return plan === "pro" || plan === "elite";
}

async function getBalanceViaRpc(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>
) {
  const { data, error } = await supabase.rpc("get_my_meta_balance");
  if (error) {
    console.error("get_my_meta_balance rpc error:", error);
    return 0;
  }
  return Number(data ?? 0);
}

/**
 * ✅ plan は profiles.id (= auth.users.id) で取る（統一）
 * - profilesが無ければ最小行を作る（止血）
 */
async function getOrCreatePlanByProfileId(profileId: string) {
  // 1) まずは id で引く
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, plan")
    .eq("id", profileId)
    .maybeSingle<{ id: string; plan: PlanName | null }>();

  if (error) {
    console.error("profiles select(plan) error:", error);
    return { ok: false as const };
  }

  if (data) {
    return { ok: true as const, plan: (data.plan ?? "free") as PlanName };
  }

  // 2) 無ければ作る（最小）
  const { error: insErr } = await supabaseAdmin.from("profiles").insert({
    id: profileId,
    auth_user_id: profileId, // 列があるなら埋めておく（null事故を止める）
    plan: "free",
    onboarding_completed: false,
  });

  if (insErr) {
    console.error("profiles insert(minimal) error:", insErr);
    return { ok: false as const };
  }

  return { ok: true as const, plan: "free" as PlanName };
}

/**
 * ✅ feature に応じて「Proは素通り / Freeはmeta消費」を統一実行
 * - balanceは常にRPC(get_my_meta_balance)で返す（=meta_lots集計）
 */
export async function requireFeatureOrConsumeMeta(
  feature: FeatureId
): Promise<FeatureGateResult> {
  const supabase = await createSupabaseServerClient();

  // 1) auth
  const { data: auth, error: authError } = await supabase.auth.getUser();
  const user = auth?.user ?? null;

  if (authError || !user?.id) {
    return { ok: false, status: 401, reason: "unauthorized" };
  }

  // 2) feature validate
  if (!(feature in FEATURE_META_COST)) {
    return { ok: false, status: 400, reason: "unknown_feature" };
  }

  const authUserId = user.id;
  const cost = FEATURE_META_COST[feature];

  // 3) plan（✅ id で取る）
  const planRes = await getOrCreatePlanByProfileId(authUserId);
  if (!planRes.ok) {
    return { ok: false, status: 500, reason: "profile_not_found" };
  }

  const plan = planRes.plan;
  const unlimited = isUnlimitedPlan(plan);

  // ✅ Pro/Elite: 消費しない。でもbalanceは返す（meta_lots集計）
  if (unlimited) {
    const balance = await getBalanceViaRpc(supabase);
    return {
      ok: true,
      status: 200,
      authUserId,
      plan,
      used: 0,
      cost,
      balance,
      isUnlimited: true,
    };
  }

  // 4) Free: consume_meta_fifo
  const { data: consumeData, error: consumeError } = await supabaseAdmin.rpc(
    "consume_meta_fifo",
    {
      p_auth_user_id: authUserId,
      p_cost: cost,
    }
  );

  if (consumeError) {
    const msg = String(consumeError.message ?? "");
    if (msg.includes("INSUFFICIENT_META")) {
      return {
        ok: false,
        status: 402,
        reason: "insufficient_meta",
        required: cost,
      };
    }
    console.error("consume_meta_fifo error:", consumeError);
    return { ok: false, status: 500, reason: "consume_failed" };
  }

  // 5) balance保証（consumeDataに無ければRPC fallback）
  const fallbackBalance = await getBalanceViaRpc(supabase);
  const balance =
    typeof consumeData === "object" &&
    consumeData !== null &&
    "balance" in (consumeData as any) &&
    Number((consumeData as any).balance) >= 0
      ? Number((consumeData as any).balance)
      : fallbackBalance;

  return {
    ok: true,
    status: 200,
    authUserId,
    plan,
    used: cost,
    cost,
    balance,
    isUnlimited: false,
  };
}

/**
 * ✅ 「残高だけ欲しい」UI用
 */
export async function getMyMetaBalance():
  Promise<FeatureGateFail | { ok: true; balance: number; }> {
  const supabase = await createSupabaseServerClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth?.user?.id) {
    return { ok: false, status: 401, reason: "unauthorized" };
  }
  const balance = await getBalanceViaRpc(supabase);
  return { ok: true, balance };
}
