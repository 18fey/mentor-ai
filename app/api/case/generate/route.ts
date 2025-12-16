// app/api/case/generate/route.ts
import { NextRequest, NextResponse } from "next/server";
import { checkMonthlyLimit, logUsage } from "@/lib/plan";
import { createServerSupabase } from "@/utils/supabase/server";

export const runtime = "nodejs";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL_GEN = process.env.OPENAI_MODEL_GEN_CASE || "gpt-4o-mini";

type CaseDomain = "consulting" | "general" | "trading" | "ib";
type CasePattern =
  | "market_sizing"
  | "profitability"
  | "entry"
  | "new_business"
  | "operation";

function safeJsonParse(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    const m = s.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("Invalid JSON from model");
    return JSON.parse(m[0]);
  }
}

const isValidDomain = (v: any): v is CaseDomain =>
  v === "consulting" || v === "general" || v === "trading" || v === "ib";

const isValidPattern = (v: any): v is CasePattern =>
  v === "market_sizing" ||
  v === "profitability" ||
  v === "entry" ||
  v === "new_business" ||
  v === "operation";

export async function POST(req: NextRequest) {
  try {
    if (!OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "server_config", message: "OPENAI_API_KEY is not set" },
        { status: 500 }
      );
    }

    // ✅ cookieセッションから本人確定（最重要）
    const supabase = createServerSupabase();
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return NextResponse.json(
        { error: "unauthorized", message: "ログインが必要です。" },
        { status: 401 }
      );
    }
    const userId = user.id;

    // ✅ userIdは受け取らない（domain/patternのみ）
    const body = (await req.json().catch(() => null)) as
      | { domain?: CaseDomain; pattern?: CasePattern }
      | null;

    const domain = body?.domain;
    const pattern = body?.pattern;

    if (!isValidDomain(domain) || !isValidPattern(pattern)) {
      return NextResponse.json(
        {
          error: "bad_request",
          message: "domain / pattern is required",
        },
        { status: 400 }
      );
    }

    // ✅ FREEは「ケース生成：月8問まで」
    const limit = await checkMonthlyLimit({
      userId,
      feature: "case_generate",
      freeLimit: 8,
    });

    if (!limit.allowed) {
      return NextResponse.json(
        {
          error: "limit_exceeded",
          code: "CASE_GENERATE_LIMIT_REACHED",
          plan: limit.plan,
          remaining: 0,
          message:
            "無料プランでのケース生成（今月8問まで）を使い切りました。PROプランにアップグレードすると無制限で利用できます。",
        },
        { status: 403 }
      );
    }

    const system = `
あなたはケース面接の出題者。日本語。現実のビジネス文脈。
必ず「JSONのみ」で返す（前後に文章を付けない）。
`.trim();

    const userPrompt = `
domain: ${domain}
pattern: ${pattern}

次のJSONでケース問題を1つ生成して：
{
  "id": "一意っぽいid（英数字と_）",
  "domain": "${domain}",
  "pattern": "${pattern}",
  "title": "短いタイトル",
  "client": "クライアント名（具体的に）",
  "prompt": "受験者への指示（4〜8行、曖昧すぎない）",
  "hint": "分解のヒント（1〜3行）",
  "kpiExamples": "見るべきKPI例（改行OK）"
}
`.trim();

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
          { role: "system", content: system },
          { role: "user", content: userPrompt },
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
    const caseObj = safeJsonParse(content);

    // ✅ 使用ログ（確定したuserIdで）
    await logUsage(userId, "case_generate");

    return NextResponse.json({
      ok: true,
      plan: limit.plan,
      remaining: Math.max(0, (limit.remaining ?? 0) - 1),
      case: caseObj,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "server_error", message: "server error" },
      { status: 500 }
    );
  }
}
