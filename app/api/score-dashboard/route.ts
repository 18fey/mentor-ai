import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

type WeeklyReportRow = {
  id: string;
  user_id: string;
  overall_score: number | null;
  case_score: number | null;
  fermi_score: number | null;
  interview_score: number | null;
  es_score: number | null;
  created_at: string;
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    // userId = Supabase auth.user.id
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "user_not_authenticated" },
        { status: 401 }
      );
    }

    // ✅ weekly_reports から最新スコアを取得（user_id = auth_user_id）
    const { data, error } = await supabaseServer
      .from("weekly_reports")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<WeeklyReportRow>();

    if (error) {
      console.error("[score-dashboard] select error:", error);
    }

    const src = data ?? null;

    const payload = {
      overallScore: src?.overall_score ?? null,
      caseScore: src?.case_score ?? null,
      fermiScore: src?.fermi_score ?? null,
      interviewScore: src?.interview_score ?? null,
      esScore: src?.es_score ?? null,
      recentSessions: src
        ? [
            {
              id: src.id,
              type: "weekly",
              title: "最新ウィークリーレポート",
              score: src.overall_score ?? null,
              createdAt: src.created_at,
            },
          ]
        : [],
    };

    return NextResponse.json(payload);
  } catch (e) {
    console.error("[score-dashboard] exception:", e);
    return NextResponse.json(
      {
        overallScore: null,
        caseScore: null,
        fermiScore: null,
        interviewScore: null,
        esScore: null,
        recentSessions: [],
        error: "score_dashboard_failed",
      },
      { status: 500 }
    );
  }
}
