// app/api/meta/use/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

// -----------------------------
// 1. Feature の ID 定義
// -----------------------------
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

// -----------------------------
// 2. 機能ごとの Meta コスト
// -----------------------------
const FEATURE_META_COST: Record<FeatureId, number> = {
  // 軽タスク（1〜2）
  es_check: 1,
  fermi: 1,
  light_questions: 1,

  // 中タスク（3〜5）
  interview_10: 3,
  industry_insight: 3,
  case_interview: 4,

  // 重〜Deep（6〜10）
  fit_analysis: 6,
  deep_16type: 10,
  enterprise_qgen: 10,
};

// -----------------------------
// 3. Request Body の型
// -----------------------------
type UseMetaRequest = {
  feature: FeatureId;
};

// -----------------------------
// 4. POST メイン処理
// -----------------------------
export async function POST(req: Request) {
  const cookieStore = await cookies();

  const supabase = createServerClient<any>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

  // 1. 認証チェック
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error("meta/use auth error:", authError);
    return NextResponse.json(
      { ok: false, reason: "unauthorized" as const },
      { status: 401 }
    );
  }

  // 2. Body パース
  let body: UseMetaRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, reason: "invalid_body" as const },
      { status: 400 }
    );
  }

  const { feature } = body;

  // 3. コスト定義に存在するか
  if (!(feature in FEATURE_META_COST)) {
    return NextResponse.json(
      { ok: false, reason: "unknown_feature" as const },
      { status: 400 }
    );
  }

  const cost = FEATURE_META_COST[feature];

  // 4. プロフィール取得
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, meta_balance, is_pro")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    console.error("meta/use profile error:", profileError);
    return NextResponse.json(
      { ok: false, reason: "profile_not_found" as const },
      { status: 500 }
    );
  }

  const currentBalance: number = profile.meta_balance ?? 0;
  const isPro: boolean = profile.is_pro ?? false;

  // 5. Pro ユーザーなら Meta 消費なしで OK
  if (isPro) {
    return NextResponse.json(
      {
        ok: true,
        used: 0,
        balance: currentBalance,
        is_pro: true,
      },
      { status: 200 }
    );
  }

  // 6. 残高チェック
  if (currentBalance < cost) {
    return NextResponse.json(
      {
        ok: false,
        reason: "insufficient_meta" as const,
        required: cost,
        balance: currentBalance,
      },
      { status: 402 }
    );
  }

  const newBalance = currentBalance - cost;

  // 7. 残高更新
  const { error: updateError } = await supabase
    .from("profiles")
    .update({ meta_balance: newBalance })
    .eq("id", user.id);

  if (updateError) {
    console.error("meta/use update error:", updateError);
    return NextResponse.json(
      { ok: false, reason: "update_failed" as const },
      { status: 500 }
    );
  }

  // 8. OKレスポンス
  return NextResponse.json(
    {
      ok: true,
      used: cost,
      balance: newBalance,
      is_pro: false,
    },
    { status: 200 }
  );
}
