// app/api/es/eval/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/utils/supabase/server";
import { getUserPlan } from "@/lib/plan";
import { requireFeatureOrConsumeMeta } from "@/lib/payment/featureGate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL_ES = process.env.OPENAI_MODEL_EVAL_ES || "gpt-4.1-mini";

// ✅ usage側の feature key（/api/usage/consume に合わせる）
const USAGE_FEATURE_KEY = "es_correction";

// ✅ featureGate側の FeatureId（FEATURE_META_COST に存在するキーに合わせる）
const GATE_FEATURE_ID = "es_correction";

// 許可する設問タイプ
const ALLOWED_QTYPES = ["self_pr", "gakuchika", "why_company", "why_industry", "other"] as const;
type QuestionType = (typeof ALLOWED_QTYPES)[number];

type EvalRequestBody = {
  text?: string;
  company?: string;
  qType?: string;
  limit?: number;

  // ⚠️ 互換用：送ってきても無視する（cookieセッションで確定する）
  userId?: string;
};

function clampInt(n: unknown, min: number, max: number, fallback: number) {
  const x = Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(x)));
}
function safeStr(v: unknown, maxLen: number) {
  if (typeof v !== "string") return "";
  return v.slice(0, maxLen);
}

export async function POST(req: NextRequest) {
  try {
    if (!OPENAI_API_KEY) {
      return NextResponse.json(
        { ok: false, error: "server_config", message: "Missing OPENAI_API_KEY" },
        { status: 500 }
      );
    }

    // ✅ cookieセッションから本人確定（body.userIdは使わない）
    const supabase = await createServerSupabase();
    const { data: auth, error: authErr } = await supabase.auth.getUser();
    const user = auth?.user ?? null;

    if (authErr || !user?.id) {
      return NextResponse.json(
        { ok: false, error: "unauthorized", message: "login required" },
        { status: 401 }
      );
    }
    const userId = user.id;

    const body = (await req.json().catch(() => null)) as EvalRequestBody | null;
    if (!body) {
      return NextResponse.json(
        { ok: false, error: "bad_request", message: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const text = typeof body.text === "string" ? body.text : "";
    const company = safeStr(body.company, 100);
    const qTypeRaw = typeof body.qType === "string" ? body.qType : "";
    const safeQType: QuestionType =
      (ALLOWED_QTYPES as readonly string[]).includes(qTypeRaw) ? (qTypeRaw as QuestionType) : "other";
    const safeLimit = clampInt(body.limit, 1, 4000, 400);

    if (!text || text.trim().length < 50) {
      return NextResponse.json(
        {
          ok: false,
          error: "bad_request",
          message: "ES本文が短すぎるか空です。少なくとも50文字以上の本文を送信してください。",
        },
        { status: 400 }
      );
    }

    const MAX_ES_LENGTH = 4000;
    const truncatedText = text.length > MAX_ES_LENGTH ? text.slice(0, MAX_ES_LENGTH) : text;

    // ✅ usage/consume：内部fetchはCookieが勝手につかないので転送
    const baseUrl = new URL(req.url).origin;
    const cookieHeader = req.headers.get("cookie") ?? "";

    const usageRes = await fetch(`${baseUrl}/api/usage/consume`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
      },
      body: JSON.stringify({ feature: USAGE_FEATURE_KEY }),
    });

    const usageJson = await usageRes.json().catch(() => null);

    // ✅ 無料枠を超えていたら → meta消費（唯一の消費場所）
    if (!usageRes.ok) {
      if (usageRes.status === 402 && usageJson?.error === "need_meta") {
        const gate = await requireFeatureOrConsumeMeta(GATE_FEATURE_ID);

        if (!gate.ok) {
          // gate は {ok:false, status:402, requiredMeta, balance, ...} を想定
          return NextResponse.json(gate, { status: gate.status });
        }
        // gate.ok なら続行（＝meta消費済み）
      } else {
        console.error("usage/consume error:", usageRes.status, usageJson);
        return NextResponse.json(
          { ok: false, error: "usage_error", message: "Failed to check usage" },
          { status: 500 }
        );
      }
    }

    const plan = await getUserPlan(userId);

    const systemPrompt =
      "あなたは日本の就活に詳しいES添削のプロです。与えられたESを評価し、指定されたJSON形式だけを返してください。";

    const userPrompt = `
以下は就活ESの回答です。構成・ロジック・分かりやすさ・企業フィット・文字数フィットの5項目で10点満点で評価し、
フィードバックを作成してください。

【企業名】:${company || "（未指定）"}
【設問タイプ】:${safeQType}
【文字数目安】:${safeLimit} 文字
【ES本文】:
${truncatedText}

返答は必ず次のJSON形式にしてください：
{
  "score": { "structure": number, "logic": number, "clarity": number, "companyFit": number, "lengthFit": number },
  "feedback": { "summary": string, "strengths": string[], "improvements": string[], "checklist": string[], "sampleStructure": string }
}
`.trim();

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENAI_MODEL_ES,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        response_format: { type: "json_object" },
        max_tokens: 900,
      }),
    });

    const data = await openaiRes.json().catch(() => null);
    if (!openaiRes.ok) {
      console.error("OpenAI API error:", data);
      return NextResponse.json({ ok: false, error: "openai_error", detail: data }, { status: 500 });
    }

    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ ok: false, error: "openai_empty" }, { status: 500 });
    }

    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      return NextResponse.json({ ok: false, error: "parse_error", raw: content }, { status: 500 });
    }

    // ✅ 形の最低限チェック
    const s = parsed?.score;
    if (!s || typeof s.structure !== "number" || !parsed?.feedback) {
      return NextResponse.json({ ok: false, error: "invalid_shape", raw: parsed }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      plan,
      usedThisMonth: typeof usageJson?.usedThisMonth === "number" ? usageJson.usedThisMonth : null,
      freeLimit: typeof usageJson?.freeLimit === "number" ? usageJson.freeLimit : null,
      ...parsed,
    });
  } catch (e) {
    console.error("POST /api/es/eval error:", e);
    return NextResponse.json({ ok: false, error: "server_error", message: "server error" }, { status: 500 });
  }
}
