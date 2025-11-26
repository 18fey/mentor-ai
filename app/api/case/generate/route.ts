// app/api/case/generate/route.ts
import { NextRequest, NextResponse } from "next/server";
import { checkMonthlyLimit, logUsage } from "@/lib/plan";

export async function POST(req: NextRequest) {
  try {
    const { userId, ...body } = await req.json();

    // 1. 利用制限チェック（FREEは月3問まで）
    const limit = await checkMonthlyLimit({
      userId,
      feature: "case_fermi",
      freeLimit: 3,
    });

    if (!limit.allowed) {
      return NextResponse.json(
        {
          error: "limit_exceeded",
          plan: limit.plan,
          remaining: 0,
          message:
            "無料プランでのケース／フェルミの利用回数（今月3問まで）を使い切りました。PROプランにアップグレードすると無制限で利用できます。",
        },
        { status: 403 }
      );
    }

    // 2. ここでOpenAI呼び出してケース生成
    // const caseResult = await callOpenAIForCase(body);

    // 3. 利用ログを追加
    await logUsage(userId, "case_fermi");

    return NextResponse.json({
      // case: caseResult,
      dummy: true, // 実際は生成結果
      plan: limit.plan,
      remaining: limit.remaining - 1,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
