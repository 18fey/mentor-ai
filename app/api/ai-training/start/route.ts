// app/api/ai-training/start/route.ts
import { NextRequest, NextResponse } from "next/server";
import { checkMonthlyLimit, logUsage } from "@/lib/plan";
import { requireAuthUserId } from "@/lib/authServer";

export async function POST(req: NextRequest) {
  try {
    // body は必要なら読む（ただし userId は受け取らない）
    await req.json().catch(() => ({}));

    const userId = await requireAuthUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "unauthorized", message: "login required" },
        { status: 401 }
      );
    }

    const limit = await checkMonthlyLimit({
      userId,
      feature: "ai_training",
      freeLimit: 1,
    });

    if (!limit.allowed) {
      return NextResponse.json(
        {
          error: "limit_exceeded",
          plan: limit.plan,
          message:
            "AI思考トレーニングは無料プランでは今月1回まで利用できます。続きはPROプランで解放されます。",
        },
        { status: 403 }
      );
    }

    await logUsage(userId, "ai_training");

    return NextResponse.json({
      ok: true,
      plan: limit.plan,
      remaining: limit.remaining === Infinity ? Infinity : limit.remaining - 1,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
