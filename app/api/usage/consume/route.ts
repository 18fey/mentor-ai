// app/api/usage/consume/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export const runtime = "nodejs";

type Plan = "free" | "beta" | "pro";
type FeatureKey =
  | "case_interview"
  | "fermi"
  | "general_interview"
  | "ai_training"
  | "es_correction";

/**
 * 機能ごとの「プラン別・月あたり無料回数」
 * null = 上限なし
 */
const FEATURE_LIMITS: Record<
  FeatureKey,
  { free: number; beta: number; pro: number | null }
> = {
  case_interview: {
    free: 3, // ケース面接：月3問まで無料
    beta: 5,
    pro: null,
  },
  fermi: {
    free: 3, // フェルミ：月3問まで無料
    beta: 5,
    pro: null,
  },
  general_interview: {
    free: 1, // 一般面接：月1回まで無料
    beta: 3,
    pro: null,
  },
  ai_training: {
    free: 1, // AI思考トレ：2回目以降有料 → free は1回
    beta: 3,
    pro: null,
  },
  es_correction: {
    free: 1, // ES添削：まず1本だけフル解放、以降はロック想定
    beta: 3,
    pro: null,
  },
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    // userId = Supabase auth.user.id
    const userId = body.userId as string | undefined;
    const feature = body.feature as FeatureKey | undefined;

    if (!userId || !feature) {
      return NextResponse.json(
        { error: "invalid_request", message: "userId と feature は必須です。" },
        { status: 400 }
      );
    }

    const config = FEATURE_LIMITS[feature];
    if (!config) {
      return NextResponse.json(
        { error: "unknown_feature", message: `未知の機能です: ${feature}` },
        { status: 400 }
      );
    }

    // ---------------------------
    // プロファイル取得（auth_user_id 単位）
    // ---------------------------
    const { data: profile, error: profileError } = await supabaseServer
      .from("users_profile")
      .select("*")
      .eq("auth_user_id", userId)
      .maybeSingle();

    if (profileError || !profile) {
      console.error("profile not found:", profileError);
      return NextResponse.json(
        {
          error: "profile_not_found",
          message: "ユーザープロファイルが見つかりません。",
        },
        { status: 404 }
      );
    }

    const profileId: string = profile.id; // feature_usage.profile_id 用
    const plan: Plan = (profile.plan as Plan) ?? "free";
    const now = new Date();

    // ---------------------------
    // usage_reset_at（無料枠リセット基準日）の更新
    //  - 初回 or 月替わりで「当月1日」にリセット
    // ---------------------------
    let resetAt: Date;
    if (profile.usage_reset_at) {
      resetAt = new Date(profile.usage_reset_at as string);
      const sameMonth =
        resetAt.getFullYear() === now.getFullYear() &&
        resetAt.getMonth() === now.getMonth();

      if (!sameMonth) {
        resetAt = new Date(now.getFullYear(), now.getMonth(), 1);
        await supabaseServer
          .from("users_profile")
          .update({ usage_reset_at: resetAt.toISOString() })
          .eq("id", profileId);
      }
    } else {
      resetAt = new Date(now.getFullYear(), now.getMonth(), 1);
      await supabaseServer
        .from("users_profile")
        .update({ usage_reset_at: resetAt.toISOString() })
        .eq("id", profileId);
    }

    // ---------------------------
    // PRO は上限なし（ログだけ残す）
    // ---------------------------
    const planLimit = config[plan];

    if (plan === "pro" || planLimit === null) {
      await supabaseServer.from("feature_usage").insert({
        profile_id: profileId,
        feature,
      });

      return NextResponse.json({
        ok: true,
        feature,
        plan,
        usedCount: null,
        remaining: null,
        limit: null,
      });
    }

    // ---------------------------
    // 今月の利用回数をカウント
    // ---------------------------
    const { data: rows, error: countError } = await supabaseServer
      .from("feature_usage")
      .select("id")
      .eq("profile_id", profileId)
      .eq("feature", feature)
      .gte("used_at", resetAt.toISOString());

    if (countError) {
      console.error("feature_usage count error:", countError);
      return NextResponse.json(
        { error: "count_failed", message: "利用状況の取得に失敗しました。" },
        { status: 500 }
      );
    }

    const usedCount = rows?.length ?? 0;

    // ---------------------------
    // 上限チェック
    // ---------------------------
    if (usedCount >= planLimit) {
      return NextResponse.json(
        {
          ok: false,
          error: "limit_exceeded",
          feature,
          plan,
          usedCount,
          remaining: 0,
          limit: planLimit,
          message:
            plan === "free"
              ? "この機能の今月の無料利用回数が上限に達しました。プラン・料金ページから PRO プランをご検討ください。"
              : "この機能の今月の利用上限に達しました。",
        },
        { status: 403 }
      );
    }

    // ---------------------------
    // 1回消費（ログ追加）
    // ---------------------------
    await supabaseServer.from("feature_usage").insert({
      profile_id: profileId,
      feature,
    });

    const newUsed = usedCount + 1;
    const remaining = Math.max(planLimit - newUsed, 0);

    return NextResponse.json({
      ok: true,
      feature,
      plan,
      usedCount: newUsed,
      remaining,
      limit: planLimit,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      {
        error: "server_error",
        message: "利用制限チェック中にエラーが発生しました。",
      },
      { status: 500 }
    );
  }
}
