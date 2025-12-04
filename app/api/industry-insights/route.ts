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
    const {
      industryGroup,
      industrySub,
      targetCompany,
      focusTopic,
      includeNews,
    } = body as {
      industryGroup: string;
      industrySub?: string | null;
      targetCompany?: string | null;
      focusTopic?: string | null;
      includeNews?: boolean;
    };

    const industryLine = industrySub
      ? `対象業界: ${industryGroup} / ${industrySub}`
      : `対象業界: ${industryGroup}`;

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
あなたは日本の就活生向けに、
「業界構造 × 個別企業の強み/弱み × 将来性（中期リスク） × 直近トレンド」
を統合して整理するプロフェッショナルキャリアメンターです。

出力は必ず JSON 形式「のみ」で行ってください。前後に説明文は書かないでください。

JSON の形式は次の通りです：

{
  "insight": "業界構造・ビジネスモデル・個別企業の位置づけ・強み/弱み・将来性（Markdown 可）",
  "questions": "想定質問リストと答え方のポイント（Markdown 可）",
  "news": "直近ニュース・トレンドと面接での語り方（Markdown 可）"
}

・コードブロック（\`\`\`json など）で囲まず、純粋な JSON テキストだけを出力してください。
・「insight」「questions」「news」の3フィールドは必ず含めてください。
    `.trim();

    const userPrompt = `
${industryLine}
${companyPart}
${focusPart}

要件:
- 就活の面接準備に直接使えるレベルで、できるだけ具体的に。
- 日本語で出力。
- 大学3〜4年生が読んで理解しやすいトーンで。
- "insight" / "questions" / "news" で、情報が被りすぎないようにしてください。
- insight では、業界構造（プレーヤー・収益源・規制・リスク）、主要論点、個別企業の位置づけに加えて、
  「強み」「弱み」「中期3〜5年の将来性（追い風・向かい風・構造的リスク）」も整理してください。
- questions では、面接で実際に聞かれそうな質問と、答え方のポイントを 10〜15 個まとめてください。
- news では、就活生が押さえておくべき直近トレンド・ニュースと、それをどう語るかのヒントを書いてください。
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
        temperature: 0.55,
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
    let content: string | null = json.choices?.[0]?.message?.content ?? null;

    if (!content) {
      throw new Error("Empty content from OpenAI");
    }

    // -------- ここから JSON クリーニング処理 --------
    let cleaned = content.trim();
    console.log("Raw content from OpenAI:", cleaned);

    // 1) ```〜``` で囲まれていたら中身だけ取り出す
    if (cleaned.startsWith("```")) {
      const firstNewline = cleaned.indexOf("\n");
      const lastFence = cleaned.lastIndexOf("```");
      if (firstNewline !== -1 && lastFence !== -1 && lastFence > firstNewline) {
        cleaned = cleaned.slice(firstNewline + 1, lastFence).trim();
      }
    }

    // 2) それでも余計な文章がついていたら、最初の { から最後の } までを抜き出す
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      cleaned = cleaned.slice(firstBrace, lastBrace + 1);
    }

    let parsed: Partial<InsightResult>;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.error("JSON parse error. Cleaned content:", cleaned, e);
      return NextResponse.json(
        { error: "インサイト生成に失敗しました（JSON parse error）" },
        { status: 500 }
      );
    }
    // -------- ここまで --------

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
