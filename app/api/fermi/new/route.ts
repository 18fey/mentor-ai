// app/api/fermi/new/route.ts
import { NextRequest, NextResponse } from "next/server";
import { checkMonthlyLimit, logUsage } from "@/lib/plan";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL_GEN = process.env.OPENAI_MODEL_GEN_FERMI || "gpt-4o-mini";

type FermiCategory = "daily" | "business" | "consulting";
type FermiDifficulty = "easy" | "medium" | "hard";

export async function POST(req: NextRequest) {
  try {
    if (!OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "server_config", message: "OPENAI_API_KEY is not set" },
        { status: 500 }
      );
    }

    const { userId, category, difficulty } = (await req.json()) as {
      userId: string;
      category: FermiCategory;
      difficulty: FermiDifficulty;
    };

    if (!userId) {
      return NextResponse.json(
        { error: "bad_request", message: "userId is required" },
        { status: 400 }
      );
    }

    // ✅ FREEは「フェルミ生成：月8問まで」
    const limit = await checkMonthlyLimit({
      userId,
      feature: "fermi_generate",
      freeLimit: 8,
    });

    if (!limit.allowed) {
      return NextResponse.json(
        {
          error: "limit_exceeded",
          code: "FERMI_GENERATE_LIMIT_REACHED",
          plan: limit.plan,
          remaining: 0,
          message:
            "無料プランでのフェルミ生成（今月8問まで）を使い切りました。PROプランにアップグレードすると無制限で利用できます。",
        },
        { status: 403 }
      );
    }

    const system = `
あなたはフェルミ推定の出題者。日本語。
必ずJSONのみで返す（前後に文章を付けない）。
`;

    const user = `
category: ${category}
difficulty: ${difficulty}

次のJSONでフェルミ問題を1つ生成して：
{
  "id": "一意っぽいid（英数字と-や_）",
  "category": "${category}",
  "difficulty": "${difficulty}",
  "title": "お題（日本語）",
  "formulaHint": "例：人口 × 利用割合 × 年間回数 × 単価",
  "defaultFactors": ["要因1","要因2","要因3","要因4"],
  "unit": "円 / 年 など"
}

ルール：
- defaultFactorsは3〜5個
- 仕事っぽい題材（business/consulting）は数字が置きやすいテーマにする
- dailyは日常の推定
`;

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENAI_MODEL_GEN,
        temperature: 0.7,
        messages: [
          { role: "system", content: system.trim() },
          { role: "user", content: user.trim() },
        ],
      }),
    });

    if (!r.ok) {
      const t = await r.text();
      console.error("OpenAI error:", t);
      return NextResponse.json(
        { error: "openai_error", message: "OpenAI API error" },
        { status: 500 }
      );
    }

    const j = await r.json();
    const content = j?.choices?.[0]?.message?.content ?? "";

    let obj: any;
    try {
      obj = JSON.parse(content);
    } catch {
      const m = content.match(/\{[\s\S]*\}/);
      if (!m) throw new Error("Invalid JSON from model");
      obj = JSON.parse(m[0]);
    }

    await logUsage(userId, "fermi_generate");

    return NextResponse.json({
      ok: true,
      plan: limit.plan,
      remaining: limit.remaining - 1,
      fermi: obj,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
