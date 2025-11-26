// app/api/ai-training/start/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getUserPlan, logUsage } from "@/lib/plan";
import { supabaseServer } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  try {
    const { userId, ...body } = await req.json();
    const plan = await getUserPlan(userId);

    if (plan === "free") {
      // 無料ユーザーは「初回のみ」
      const { count, error } = await supabaseServer
        .from("usage_logs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("feature", "ai_training");

      if (!error && (count ?? 0) >= 1) {
        return NextResponse.json(
          {
            error: "limit_exceeded",
            plan,
            message:
              "AI思考トレーニングは無料プランでは1回まで利用できます。続きはPROプランで解放されます。",
          },
          { status: 403 }
        );
      }
    }

    // 実際のセッション開始処理
    await logUsage(userId, "ai_training");

    return NextResponse.json({
      plan,
      // trainingSessionId: ...
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

