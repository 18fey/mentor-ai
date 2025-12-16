// app/api/meta/use/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { supabaseServer } from "@/lib/supabase-server";

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

type UseMetaRequest = {
  feature: FeatureId;
};

async function createSupabaseFromCookies() {
  const cookieStore = await cookies();
  return createServerClient<any>(
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

export async function POST(req: Request) {
  const supabase = await createSupabaseFromCookies();

  // 1) 認証
  const { data: auth, error: authError } = await supabase.auth.getUser();
  const user = auth?.user ?? null;

  if (authError || !user?.id) {
    console.error("meta/use auth error:", authError);
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

  // 3) feature validate
  if (!(feature in FEATURE_META_COST)) {
    return NextResponse.json({ ok: false, reason: "unknown_feature" as const }, { status: 400 });
  }

  const cost = FEATURE_META_COST[feature];
  const authUserId = user.id;

  // 4) profile 取得（auth_user_id で統一）
  const { data: profile, error: profileError } = await supabaseServer
    .from("profiles")
    .select("id, meta_balance, is_pro")
    .eq("auth_user_id", authUserId)
    .single();

  if (profileError || !profile) {
    console.error("meta/use profile error:", profileError);
    return NextResponse.json({ ok: false, reason: "profile_not_found" as const }, { status: 500 });
  }

  const currentBalance: number = profile.meta_balance ?? 0;
  const isPro: boolean = profile.is_pro ?? false;

  // 5) Pro は消費なし
  if (isPro) {
    return NextResponse.json({ ok: true, used: 0, balance: currentBalance, is_pro: true }, { status: 200 });
  }

  // 6) 残高チェック
  if (currentBalance < cost) {
    return NextResponse.json(
      { ok: false, reason: "insufficient_meta" as const, required: cost, balance: currentBalance },
      { status: 402 }
    );
  }

  const newBalance = currentBalance - cost;

  // 7) 更新（Service Role）
  const { error: updateError } = await supabaseServer
    .from("profiles")
    .update({ meta_balance: newBalance })
    .eq("auth_user_id", authUserId);

  if (updateError) {
    console.error("meta/use update error:", updateError);
    return NextResponse.json({ ok: false, reason: "update_failed" as const }, { status: 500 });
  }

  return NextResponse.json({ ok: true, used: cost, balance: newBalance, is_pro: false }, { status: 200 });
}
