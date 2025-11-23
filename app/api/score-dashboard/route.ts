import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

const DEFAULT_USER_ID = "demo-user";

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
    const userId = searchParams.get("userId") ?? DEFAULT_USER_ID;

    // ✅ 将来用：weekly_reports から最新スコアを取得
    const { data, error } = await supabaseServer
      .from("weekly_reports")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<WeeklyReportRow>();

    if (error) {
      console.error("[score-dashboard] select error:", error);
      // エラー時も画面を死なせないためにデモ値を返す
    }

    const src = data ?? null;

    const payload = {
      overallScore: src?.overall_score ?? 88,
      caseScore: src?.case_score ?? 86,
      fermiScore: src?.fermi_score ?? 84,
      interviewScore: src?.interview_score ?? 91,
      esScore: src?.es_score ?? 89,
      recentSessions: [
        // 将来: interview_sessions / fermi_sessions / story_cards から直近の履歴を入れる
        {
          id: src?.id ?? "demo-1",
          type: "case",
          title: "売上向上ケース",
          score: src?.case_score ?? 86,
          createdAt: src?.created_at ?? new Date().toISOString(),
        },
      ],
    };

    return NextResponse.json(payload);
  } catch (e) {
    console.error("[score-dashboard] exception:", e);
    // ここも fallback でデモ値
    return NextResponse.json({
      overallScore: 88,
      caseScore: 86,
      fermiScore: 84,
      interviewScore: 91,
      esScore: 89,
      recentSessions: [
        {
          id: "demo-1",
          type: "case",
          title: "売上向上ケース",
          score: 86,
          createdAt: new Date().toISOString(),
        },
      ],
    });
  }
}
