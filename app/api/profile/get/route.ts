// app/api/profile/get/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

/**
 * GET /api/profile/get?userId=xxx
 * ・将来 Supabase Auth 導入時は auth_user_id を userId に渡す設計
 * ・今は demo-user を暫定利用
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId") ?? "demo-user";

    // 🔑 今は id で検索しているが、
    // Auth導入後は .eq("auth_user_id", userId) に切り替えるだけでOK
    const { data, error } = await supabaseServer
      .from("users_profile")
      .select("*")
      .eq("id", userId)
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
