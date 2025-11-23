// app/api/data/export/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
// import type { Database } from "@/lib/database.types"; // 型定義あるなら

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }

  const userId = user.id;

  // プロフィール
  const { data: profile } = await supabase
    .from("users_profile")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  // 面接セッション
  const { data: interviewSessions } = await supabase
    .from("interview_sessions")
    .select("*")
    .eq("user_id", userId);

  // ストーリーカード
  const { data: storyCards } = await supabase
    .from("story_cards")
    .select("*")
    .eq("user_id", userId);

  // ES評価など他にも持っているテーブルがあればここに足す
  // const { data: esEvaluations } = await supabase
  //   .from("es_evaluations")
  //   .select("*")
  //   .eq("user_id", userId);

  const payload = {
    exported_at: new Date().toISOString(),
    user: {
      id: user.id,
      email: user.email,
    },
    profile,
    interviewSessions: interviewSessions ?? [],
    storyCards: storyCards ?? [],
    // esEvaluations: esEvaluations ?? [],
  };

  return NextResponse.json(payload, {
    status: 200,
  });
}
