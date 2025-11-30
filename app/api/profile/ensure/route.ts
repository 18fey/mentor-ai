// app/api/profile/ensure/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

type SaveProfileBody = {
  // 最低限あればOKな項目
  userId?: string;        // Supabase auth.user.id（フロントから渡す）
  authUserId?: string;    // どちらを使ってもOKだが、最終的には auth_user_id に保存
  name?: string;
  university?: string;
  faculty?: string;
  grade?: string;
  interestedIndustries?: string[]; // interested_industries
  valuesTags?: string[];           // values_tags
};

function getLogicalUserId(body: SaveProfileBody | null): string | null {
  if (!body) return null;
  return body.authUserId ?? body.userId ?? null;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as SaveProfileBody | null;

    if (!body) {
      return NextResponse.json(
        { ok: false, error: "invalid_body" },
        { status: 400 }
      );
    }

    const authUserId = getLogicalUserId(body);

    // ✅ demo-user にフォールバックせず必須にする（完全個別化）
    if (!authUserId) {
      return NextResponse.json(
        { ok: false, error: "user_not_authenticated" },
        { status: 401 }
      );
    }

    const { data, error } = await supabaseServer
      .from("users_profile")
      .upsert(
        {
          auth_user_id: authUserId,
          name: body.name ?? null,
          university: body.university ?? null,
          faculty: body.faculty ?? null,
          grade: body.grade ?? null,
          interested_industries: body.interestedIndustries ?? [],
          values_tags: body.valuesTags ?? [],
        },
        {
          // SQL で作ってある unique index
          onConflict: "auth_user_id",
        }
      )
      .select("*")
      .maybeSingle();

    if (error) {
      console.error("Supabase profile UPSERT error:", error);
      return NextResponse.json(
        { ok: false, error: "profile_save_failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, profile: data });
  } catch (e) {
    console.error("profile POST unexpected error:", e);
    return NextResponse.json(
      { ok: false, error: "profile_save_failed" },
      { status: 500 }
    );
  }
}
