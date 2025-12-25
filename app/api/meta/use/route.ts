// app/api/meta/use/route.ts


// DEPRECATED
// This route is kept for reference only.
// Meta consumption logic has been moved to lib/payment/featureGate.
// Do NOT use this route for new implementations.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type FeatureId =
  | "es_check"
  | "fermi"
  | "light_questions"
  | "interview_10"
  | "industry_insight"
  | "case_interview"
  | "fit_analysis"
  | "deep_16type"
  | "enterprise_qgen";

const FEATURE_META_COST: Record<FeatureId, number> = {
  es_check: 1,
  fermi: 1,
  light_questions: 1,
  interview_10: 3,
  industry_insight: 3,
  case_interview: 4,
  fit_analysis: 6,
  deep_16type: 10,
  enterprise_qgen: 10,
};

type UseMetaRequest = { feature?: FeatureId };

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

// service role（RLSをバイパスしてRPCを叩ける：Route Handler内だけで使用）
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getBalanceViaRpc(supabase: Awaited<ReturnType<typeof createSupabaseFromCookies>>) {
  const { data, error } = await supabase.rpc("get_my_meta_balance");
  if (error) {
    console.error("get_my_meta_balance rpc error:", error);
    return 0;
  }
  return Number(data ?? 0);
}

export async function POST(req: Request) {
  const supabase = await createSupabaseFromCookies();

  // 1) 認証（cookie session）
  const { data: auth, error: authError } = await supabase.auth.getUser();
  const user = auth?.user ?? null;

  if (authError || !user?.id) {
    return NextResponse.json({ ok: false, reason: "unauthorized" as const }, { status: 401 });
  }

  // 2) Body
  const body = (await req.json().catch(() => ({}))) as UseMetaRequest;
  const feature = body.feature;

  // 3) validate
  if (!feature || !(feature in FEATURE_META_COST)) {
    return NextResponse.json({ ok: false, reason: "unknown_feature" as const }, { status: 400 });
  }

  const cost = FEATURE_META_COST[feature];
  const authUserId = user.id;

  // 4) plan取得（ズレ耐性：profiles.auth_user_idで引く）
  const { data: profile, error: pErr } = await supabaseAdmin
    .from("profiles")
    .select("plan")
    .eq("auth_user_id", authUserId)
    .maybeSingle<{ plan: "free" | "pro" | null }>();

  if (pErr || !profile) {
    console.error("meta/use profile error:", pErr);
    return NextResponse.json({ ok: false, reason: "profile_not_found" as const }, { status: 500 });
  }

  // ✅ proは消費しない。でも残高は meta_lots 集計で返す（正）
  if (profile.plan === "pro") {
    const balance = await getBalanceViaRpc(supabase);
    return NextResponse.json(
      {
        ok: true,
        used: 0,
        balance,
        is_pro: true,
      },
      { status: 200 }
    );
  }

  // 5) 非Pro：RPCで消費（FIFO/期限/atomic）
  const { data: consumeData, error: consumeError } = await supabaseAdmin.rpc("consume_meta_fifo", {
    p_auth_user_id: authUserId,
    p_cost: cost,
  });

  if (consumeError) {
    const msg = String(consumeError.message ?? "");
    if (msg.includes("INSUFFICIENT_META")) {
      return NextResponse.json(
        { ok: false, reason: "insufficient_meta" as const, required: cost },
        { status: 402 }
      );
    }
    if (msg.includes("INVALID_COST")) {
      return NextResponse.json({ ok: false, reason: "invalid_cost" as const }, { status: 400 });
    }
    console.error("consume_meta_fifo error:", consumeError);
    return NextResponse.json({ ok: false, reason: "consume_failed" as const }, { status: 500 });
  }

  // 6) balanceを必ず返す（consumeDataに無ければRPCフォールバック）
  const fallbackBalance = await getBalanceViaRpc(supabase);
  const balance =
    typeof consumeData === "object" &&
    consumeData !== null &&
    "balance" in (consumeData as any) &&
    Number((consumeData as any).balance) >= 0
      ? Number((consumeData as any).balance)
      : fallbackBalance;

  return NextResponse.json(
    {
      ok: true,
      used: cost,
      balance,
      is_pro: false,
      ...(typeof consumeData === "object" && consumeData !== null ? consumeData : {}),
    },
    { status: 200 }
  );
}
