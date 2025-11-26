// app/api/es/correct/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getUserPlan } from "@/lib/plan";
// import { callOpenAIForES } from "@/lib/openai-es";

type EsFeedback = {
  summary: string;
  strengths: string[];
  improvements: string[];
  sampleRewrite: string;
};

export async function POST(req: NextRequest) {
  try {
    const { userId, esText, company, questionType } = await req.json();

    const plan = await getUserPlan(userId);

    // 1. OpenAIなどでフルフィードバック生成
    // const full: EsFeedback = await callOpenAIForES(...);
    const full: EsFeedback = {
      summary: "ここに要約コメントが入ります。",
      strengths: [
        "強み1",
        "強み2",
        "強み3",
      ],
      improvements: [
        "改善ポイント1",
        "改善ポイント2",
      ],
      sampleRewrite: "ここに書き換え例が入ります。・・・",
    };

    if (plan === "pro") {
      // PROはフルで返す
      return NextResponse.json({
        plan,
        locked: false,
        feedback: full,
      });
    }

    // FREE：冒頭だけ返す
    const partial: EsFeedback = {
      summary: full.summary,
      strengths: full.strengths.slice(0, 1), // 最初の1個だけ表示
      improvements: [],                       // 改善案は非表示
      sampleRewrite: full.sampleRewrite.slice(0, 80) + "…",
    };

    return NextResponse.json({
      plan,
      locked: true,
      feedback: partial,
      message:
        "ES添削の詳細な改善案・書き換え例はPROプラン限定です。続きはPROでご覧いただけます。",
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
