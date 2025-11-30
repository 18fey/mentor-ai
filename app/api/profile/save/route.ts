import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

// DB 行のざっくり型（完全じゃなくてOK）
type UserProfileRow = {
  id: string;
  auth_user_id: string | null;
  name: string | null;
  university: string | null;
  faculty: string | null;
  grade: string | null;
  interested_industries: string[] | null;
  values_tags: string[] | null;
  plan: string | null;
  beta_user: boolean | null;
};

// いまは query/body から渡してるけど、
// 本番仕様では Supabase Auth の user.id（= auth_user_id）を想定
function getLogicalUserIdFromRequest(req: NextRequest): string | null {
  const { searchParams } = new URL(req.url);
  return searchParams.get("userId") ?? searchParams.get("id") ?? null;
}

/**
 * GET: プロフィール取得
 *   /api/profile/save?userId=xxx
 *   userId = Supabase auth.user.id
 */
export async function GET(req: NextRequest) {
  try {
    const logicalUserId = getLogicalUserIdFromRequest(req);

    if (!logicalUserId) {
      return NextResponse.json(
        { error: "user_not_authenticated", profile: null },
        { status: 401 }
      );
    }

    // auth_user_id 単位で完全個別化
    const { data, error } = await supabaseServer
      .from("users_profile")
      .select("*")
      .eq("auth_user_id", logicalUserId)
      .limit(1)
      .maybeSingle<UserProfileRow>();

    if (error) {
      console.error("[profile] GET error:", error);
      return NextResponse.json(
        { error: "profile_get_failed" },
        { status: 500 }
      );
    }

    if (!data) {
      // まだプロフィール未作成
      return NextResponse.json({ profile: null });
    }

    return NextResponse.json({
      profile: {
        id: data.id,
        authUserId: data.auth_user_id,
        name: data.name ?? "",
        university: data.university ?? "",
        faculty: data.faculty ?? "",
        grade: data.grade ?? "",
        interestedIndustries: data.interested_industries ?? [],
        valuesTags: data.values_tags ?? [],
        plan: data.plan ?? "free",
        betaUser: data.beta_user ?? false,
      },
    });
  } catch (e) {
    console.error("[profile] GET exception:", e);
    return NextResponse.json(
      { error: "profile_get_failed" },
      { status: 500 }
    );
  }
}

/**
 * POST: プロフィール保存（upsert）
 * body: {
 *   userId?: string;     // Supabase auth.user.id
 *   authUserId?: string; // ↑どちらでもOKだが、最終的には auth_user_id に入れる
 *   name?: string;
 *   university?: string;
 *   faculty?: string;
 *   grade?: string;
 *   interestedIndustries?: string[];
 *   valuesTags?: string[];
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as any));

    const authUserId: string | null =
      body.authUserId ?? body.userId ?? body.id ?? null;

    if (!authUserId) {
      return NextResponse.json(
        { error: "user_not_authenticated" },
        { status: 401 }
      );
    }

    const rowToUpsert = {
      auth_user_id: authUserId,
      name: body.name ?? null,
      university: body.university ?? null,
      faculty: body.faculty ?? null,
      grade: body.grade ?? null,
      interested_industries: body.interestedIndustries ?? [],
      values_tags: body.valuesTags ?? [],
      // plan / beta_user / usage_reset_at 等は他 API から更新
    };

    const { error } = await supabaseServer
      .from("users_profile")
      .upsert(rowToUpsert, {
        onConflict: "auth_user_id", // 1ユーザー1レコード
      });

    if (error) {
      console.error("[profile] POST error:", error);
      return NextResponse.json(
        { error: "profile_save_failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[profile] POST exception:", e);
    return NextResponse.json(
      { error: "profile_save_failed" },
      { status: 500 }
    );
  }
}
