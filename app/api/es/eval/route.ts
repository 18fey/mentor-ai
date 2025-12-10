// app/api/es/eval/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.warn(
    "❗ OPENAI_API_KEY が設定されていません。.env.local を確認してください。"
  );
}

// 許可する設問タイプ
const ALLOWED_QTYPES = [
  "self_pr",
  "gakuchika",
  "why_company",
  "why_industry",
  "other",
] as const;
type QuestionType = (typeof ALLOWED_QTYPES)[number];

export async function POST(req: Request) {
  try {
    if (!OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "Missing OPENAI_API_KEY" },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => null);

    if (!body) {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const { text, company, qType, limit, userId } = body as {
      text?: string;
      company?: string;
      qType?: string;
      limit?: number;
      userId?: string; // ★ 任意：渡されればログに使う
    };

    // ===== 入力バリデーション =====
    if (!text || typeof text !== "string" || text.trim().length < 50) {
      return NextResponse.json(
        {
          error:
            "ES本文が短すぎるか空です。少なくとも50文字以上の本文を送信してください。",
        },
        { status: 400 }
      );
    }

    const safeQType: QuestionType =
      (ALLOWED_QTYPES as readonly string[]).includes(qType || "")
        ? (qType as QuestionType)
        : "other";

    const safeLimit =
      typeof limit === "number" && limit > 0 && limit < 4000
        ? limit
        : 400; // デフォルト400文字目安

    const safeCompany =
      typeof company === "string" ? company.slice(0, 100) : "";

    // ES本文は長すぎるとトークン溢れの原因になるので、ある程度で切る
    const MAX_ES_LENGTH = 4000; // ざっくり4,000文字まで
    const truncatedText =
      text.length > MAX_ES_LENGTH ? text.slice(0, MAX_ES_LENGTH) : text;

    const systemPrompt =
      "あなたは日本の就活に詳しいES添削のプロです。" +
      "与えられたESを評価し、指定されたJSON形式だけを返してください。" +
      "文章や説明は一切書かず、JSONのみを返してください。";

    const userPrompt = `
以下は就活ESの回答です。構成・ロジック・分かりやすさ・企業フィット・文字数フィットの5項目で10点満点で評価し、
フィードバックを作成してください。

---
【企業名（空なら空欄）】:
${safeCompany || "（未指定）"}

【設問タイプ】:
${safeQType}

【文字数目安】:
${safeLimit} 文字

【ES本文】:
${truncatedText}
---

返答は必ず次のJSON形式にしてください：

{
  "score": {
    "structure": number,
    "logic": number,
    "clarity": number,
    "companyFit": number,
    "lengthFit": number
  },
  "feedback": {
    "summary": string,
    "strengths": string[],
    "improvements": string[],
    "checklist": string[],
    "sampleStructure": string
  }
}
`;

    const openaiRes = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4.1-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.3,
          // JSONだけ返してほしい、と明示
          response_format: { type: "json_object" },
          max_tokens: 800,
        }),
      }
    );

    const data = await openaiRes.json();

    if (!openaiRes.ok) {
      console.error("OpenAI API error:", data);
      return NextResponse.json(
        { error: "OpenAI API error", detail: data },
        { status: 500 }
      );
    }

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      console.error("No content in OpenAI response:", data);
      return NextResponse.json(
        { error: "No content from OpenAI" },
        { status: 500 }
      );
    }

    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      console.error("Failed to parse OpenAI JSON:", content);
      return NextResponse.json(
        {
          error: "Failed to parse OpenAI JSON",
          raw: content,
        },
        { status: 500 }
      );
    }

    // 最低限のフィールド存在チェック（壊れたJSONをそのまま返さない）
    if (
      !parsed.score ||
      typeof parsed.score.structure !== "number" ||
      !parsed.feedback
    ) {
      console.error("Invalid JSON shape from OpenAI:", parsed);
      return NextResponse.json(
        {
          error: "Invalid JSON shape from OpenAI",
          raw: parsed,
        },
        { status: 500 }
      );
    }

    // 🔢 スコアから平均などを計算（es_logs用）
    const s = parsed.score;
    const avgScore = Math.round(
      (s.structure + s.logic + s.clarity + s.companyFit + s.lengthFit) / 5
    );

    // 🧠 userId があれば es_logs / growth_logs にも保存（任意）
    if (userId) {
      try {
        const { error: esLogError } = await supabaseServer
          .from("es_logs")
          .insert({
            user_id: userId,
            company_name: safeCompany || null,
            es_question: safeQType,
            es_before: truncatedText,
            es_after: null,
            mode: "eval",
            score: avgScore,
          });

        if (esLogError) {
          console.error("es_logs insert error (eval):", esLogError);
        }

        const titleBase = safeCompany
          ? `ES評価：${safeCompany}`
          : "ES評価";

        const { error: growthError } = await supabaseServer
          .from("growth_logs")
          .insert({
            user_id: userId,
            source: "es",
            title: `${titleBase} [Score]`,
            description: "ESのスコアリングとフィードバックを実施しました。",
            metadata: {
              mode: "eval",
              company: safeCompany || null,
              qType: safeQType,
              score: parsed.score,
            },
          });

        if (growthError) {
          console.error("growth_logs insert error (es_eval):", growthError);
        }
      } catch (logErr) {
        console.error("logging error in /api/es/eval:", logErr);
      }
    }

    // そのままフロントに返す（score + feedback）
    return NextResponse.json(parsed);
  } catch (e) {
    console.error("POST /api/es/eval error:", e);
    return NextResponse.json(
      { error: "Unexpected error" },
      { status: 500 }
    );
  }
}
