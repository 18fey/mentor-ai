// app/api/profile/get/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

/**
 * GET /api/profile/get?userId=xxx
 *
 * B. 完全プロダクト仕様：
 * ・userId には Supabase auth.user.id を渡す
 * ・users_profile.auth_user_id 単位でプロファイルを取得
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    // ✅ demo-user にフォールバックしない
    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "user_not_authenticated", profile: null },
        { status: 401 }
      );
    }

    // auth_user_id ベースで検索（完全個別化）
    const { data, error } = await supabaseServer
      .from("users_profile")
      .select("*")
      .eq("auth_user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("[profile/get] Supabase error:", error);
      return NextResponse.json(
        { ok: false, error: "profile_get_failed", profile: null },
        { status: 500 }
      );
    }

    // ✅ 未登録ユーザー
    if (!data) {
      return NextResponse.json({
        ok: true,
        profile: null,
        isNewUser: true,
      });
    }

    // ✅ フロント用に正規化
    const profile = {
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
    };

    return NextResponse.json({
      ok: true,
      profile,
      isNewUser: false,
    });
  } catch (e) {
    console.error("[profile/get] unexpected error:", e);
    return NextResponse.json(
      { ok: false, error: "profile_get_failed", profile: null },
      { status: 500 }
    );
  }
}
