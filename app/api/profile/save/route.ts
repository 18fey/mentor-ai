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

// いまは query/body から渡してるけど、将来は Supabase Auth の user.id に置き換える想定
function getLogicalUserIdFromRequest(req: NextRequest): string {
  const { searchParams } = new URL(req.url);
  return (
    searchParams.get("userId") ??
    searchParams.get("id") ??
    "demo-user"
  );
}

/**
 * GET: プロフィール取得
 *   /api/profile/save?userId=xxx
 */
export async function GET(req: NextRequest) {
  try {
    const logicalUserId = getLogicalUserIdFromRequest(req);

    // いまは "id" カラムを論理的な userId として使う
    const { data, error } = await supabaseServer
      .from("users_profile")
      .select("*")
      .eq("id", logicalUserId)
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
      return NextResponse.json({ profile: null });
    }

    return NextResponse.json({
      profile: {
        id: data.id,
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
 *   id?: string; // なければ "demo-user"
 *   name?: string;
 *   university?: string;
 *   faculty?: string;
 *   grade?: string;
 *   interestedIndustries?: string[];
 *   valuesTags?: string[];
 * }
 *
 * 将来 Auth を入れたら:
 *   - auth_user_id に Supabase Auth の user.id を入れる
 *   - id は UUID 主キー or 内部ID に移行
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const logicalUserId: string = body.id ?? "demo-user";

    const rowToUpsert = {
      id: logicalUserId,
      name: body.name ?? "",
      university: body.university ?? "",
      faculty: body.faculty ?? "",
      grade: body.grade ?? "",
      interested_industries: body.interestedIndustries ?? [],
      values_tags: body.valuesTags ?? [],
      // plan / beta_user は決済API側で更新するのでここではいじらない
    };

    const { error } = await supabaseServer
      .from("users_profile")
      .upsert(rowToUpsert, {
        onConflict: "id", // 1ユーザー1レコード
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
