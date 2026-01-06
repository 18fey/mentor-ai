// app/api/career-gap/last/route.ts
import { NextResponse } from "next/server";
import { createServerSupabase } from "@/utils/supabase/server";

type SavedCareerGapMode = "lite" | "deep";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createServerSupabase();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "unauthorized", message: "ログインが必要です。" },
        { status: 401 }
      );
    }

    // profiles のキーが環境で違っても落ちないように、まず id、それでダメなら auth_user_id を試す
    const { data: p1, error: e1 } = await supabase
      .from("profiles")
      .select("career_gap_mode, career_gap_result, career_gap_updated_at")
      .eq("id", user.id)
      .maybeSingle<{
        career_gap_mode: SavedCareerGapMode | null;
        career_gap_result: string | null;
        career_gap_updated_at: string | null;
      }>();

    if (e1) {
      console.error("profiles select error (by id):", e1);
    }

    let profile = p1;

    if (!profile) {
      const { data: p2, error: e2 } = await supabase
        .from("profiles")
        .select("career_gap_mode, career_gap_result, career_gap_updated_at")
        .eq("auth_user_id", user.id)
        .maybeSingle<{
          career_gap_mode: SavedCareerGapMode | null;
          career_gap_result: string | null;
          career_gap_updated_at: string | null;
        }>();

      if (e2) {
        console.error("profiles select error (by auth_user_id):", e2);
      }

      profile = p2 ?? null;
    }

    return NextResponse.json({
      ok: true,
      mode: profile?.career_gap_mode ?? null,
      result: profile?.career_gap_result ?? null,
      updatedAt: profile?.career_gap_updated_at ?? null,
    });
  } catch (e) {
    console.error("career-gap/last server_error:", e);
    return NextResponse.json(
      { ok: false, error: "server_error", message: "取得中にエラーが発生しました。" },
      { status: 500 }
    );
  }
}
