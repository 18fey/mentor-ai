// app/api/industry-insights/route.ts
import { NextResponse } from "next/server";

type InsightResult = {
  insight: string;
  questions: string;
  news: string;
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { industry, targetCompany, focusTopic, includeNews } = body as {
      industry: string;
      targetCompany?: string | null;
      focusTopic?: string | null;
      includeNews?: boolean;
    };

    const companyPart = targetCompany
      ? `志望企業: ${targetCompany}`
      : "志望企業: 特に指定なし";
    const focusPart = focusTopic
      ? `特に深掘りしたいテーマ: ${focusTopic}`
      : "特に深掘りしたいテーマ: 特になし";
    const newsPart = includeNews
      ? "直近1〜2年のニュース・トレンドも整理してください。"
      : "ニュース・トレンドは簡潔で構いません。";

    const systemPrompt = `
あなたは日本の就活生向けに、業界インサイトを整理するプロフェッショナルキャリアメンターです。
出力は必ず JSON 形式「のみ」で行ってください。前後に説明文は書かないでください。

JSON の形式は次の通りです：

{
  "insight": "業界構造・ビジネスモデル・押さえるべき論点の解説（Markdown 可）",
  "questions": "想定質問リストと答え方のポイント（Markdown 可）",
  "news": "直近ニュース・トレンドと面接での語り方（Markdown 可）"
}
    `.trim();

    const userPrompt = `
対象業界: ${industry}
${companyPart}
${focusPart}

要件:
- 就活の面接準備に直接使えるレベルで、できるだけ具体的に。
- 日本語で出力。
- 大学3〜4年生が読んで理解しやすいトーンで。
- "insight" / "questions" / "news" で、情報が被りすぎないようにしてください。
${newsPart}
    `.trim();

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("OpenAI API error:", errText);
      return NextResponse.json(
        { error: "OpenAI API error" },
        { status: 500 }
      );
    }

    const json = await res.json();
    const content = json.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("Empty content from OpenAI");
    }

    // モデルに「JSONだけ出して」とお願いしているので、それをパースする
    let parsed: Partial<InsightResult>;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      console.error("JSON parse error. Raw content:", content);
      throw new Error("JSON parse error");
    }

    const result: InsightResult = {
      insight: parsed.insight ?? "インサイト情報を取得できませんでした。",
      questions:
        parsed.questions ?? "想定質問情報を取得できませんでした。",
      news: parsed.news ?? "ニュース情報を取得できませんでした。",
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Industry Insights API error:", error);
    return NextResponse.json(
      { error: "インサイト生成に失敗しました" },
      { status: 500 }
    );
  }
}
