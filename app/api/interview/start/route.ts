// app/api/interview/start/route.ts
import { NextRequest, NextResponse } from "next/server";
import { checkMonthlyLimit, logUsage } from "@/lib/plan";

export async function POST(req: NextRequest) {
  try {
    const { userId, ...body } = await req.json();

    const limit = await checkMonthlyLimit({
      userId,
      feature: "interview",
      freeLimit: 1,
    });

    if (!limit.allowed) {
      return NextResponse.json(
        {
          error: "limit_exceeded",
          plan: limit.plan,
          message:
            "無料プランでの一般面接AIの利用回数（今月1回まで）を使い切りました。PROプランにアップグレードすると無制限で利用できます。",
        },
        { status: 403 }
      );
    }

    // 実際の面接セッション作成など
    // const session = await createInterviewSession(userId, body);

    await logUsage(userId, "interview");

    return NextResponse.json({
      // sessionId: session.id,
      plan: limit.plan,
      remaining: limit.remaining - 1,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
