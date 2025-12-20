// app/api/meta/use/route.ts
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

type UseMetaRequest = { feature: FeatureId };

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

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  const supabase = await createSupabaseFromCookies();

  // 1) 認証
  const { data: auth, error: authError } = await supabase.auth.getUser();
  const user = auth?.user ?? null;

  if (authError || !user?.id) {
    return NextResponse.json({ ok: false, reason: "unauthorized" as const }, { status: 401 });
  }

  // 2) Body
  let body: UseMetaRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid_body" as const }, { status: 400 });
  }

  const { feature } = body;

  // 3) validate
  if (!(feature in FEATURE_META_COST)) {
    return NextResponse.json({ ok: false, reason: "unknown_feature" as const }, { status: 400 });
  }

  const cost = FEATURE_META_COST[feature];
  const authUserId = user.id;

  // 4) Pro判定（planで統一）
  const { data: profile, error: pErr } = await supabaseAdmin
    .from("profiles")
    .select("plan, meta_balance")
    .eq("id", authUserId) // ✅ 統一: profiles.id = auth.users.id
    .maybeSingle();

  if (pErr || !profile) {
    console.error("meta/use profile error:", pErr);
    return NextResponse.json({ ok: false, reason: "profile_not_found" as const }, { status: 500 });
  }

  if (profile.plan === "pro") {
    return NextResponse.json({
      ok: true,
      used: 0,
      balance: profile.meta_balance ?? 0,
      is_pro: true,
    });
  }

  // 5) 非ProはRPCで消費（FIFO/期限/atomic）
  const { data, error } = await supabaseAdmin.rpc("consume_meta_fifo", {
    p_auth_user_id: authUserId,
    p_cost: cost,
  });

  if (error) {
    const msg = String(error.message ?? "");
    if (msg.includes("INSUFFICIENT_META")) {
      return NextResponse.json(
        { ok: false, reason: "insufficient_meta" as const, required: cost },
        { status: 402 }
      );
    }
    console.error("consume_meta_fifo error:", error);
    return NextResponse.json({ ok: false, reason: "consume_failed" as const }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    used: cost,
    ...(typeof data === "object" ? data : {}),
    is_pro: false,
  });
}
