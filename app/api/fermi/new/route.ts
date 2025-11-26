// app/api/fermi/new/route.ts
import { NextRequest, NextResponse } from "next/server";
import { checkMonthlyLimit, logUsage } from "@/lib/plan";
// import { callOpenAIForFermi } from "@/lib/openai-fermi";

export async function POST(req: NextRequest) {
  try {
    const { userId, category, difficulty } = await req.json();

    // ✅ ケース＋フェルミ 合算で「月3問」のうちの1つとしてカウント
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
            "無料プランでのケース／フェルミの利用回数（月3問まで）を使い切りました。PROプランにアップグレードすると無制限で利用できます。",
        },
        { status: 403 }
      );
    }

    // ここで実際のフェルミ問題を生成（ダミーで書いておく）
    // const fermiQuestion = await callOpenAIForFermi({ category, difficulty });

    const fermiQuestion = {
      question: "例：日本のカフェ市場規模は？",
      formulaHint: "人口 × カフェ利用率 × 平均単価 × 利用頻度 など",
      unit: "円/年",
    };

    // ✅ 利用ログに記録
    await logUsage(userId, "case_fermi");

    return NextResponse.json({
      plan: limit.plan,
      remaining: limit.remaining - 1, // この呼び出しで1消費
      fermi: fermiQuestion,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
