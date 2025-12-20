// app/api/es/eval/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.warn("❗ OPENAI_API_KEY が設定されていません。.env.local を確認してください。");
}

type Database = any;

async function createSupabaseFromCookies() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          cookieStore.set({ name, value: "", ...options });
        },
      },
    }
  );
}

// 許可する設問タイプ
const ALLOWED_QTYPES = ["self_pr", "gakuchika", "why_company", "why_industry", "other"] as const;
type QuestionType = (typeof ALLOWED_QTYPES)[number];

type EvalRequestBody = {
  text?: string;
  company?: string;
  qType?: string;
  limit?: number;
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
      return NextResponse.json({ ok: false, error: "Missing OPENAI_API_KEY" }, { status: 500 });
    }

    // ✅ userId はセッションから確定
    const supabase = await createSupabaseFromCookies();
    const { data: auth, error: authErr } = await supabase.auth.getUser();
    const user = auth?.user ?? null;

    if (authErr || !user?.id) {
      return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
    }

    const authUserId = user.id;

    const body = (await req.json().catch(() => null)) as EvalRequestBody | null;
    if (!body) {
      return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
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
          error: "ES本文が短すぎるか空です。少なくとも50文字以上の本文を送信してください。",
        },
        { status: 400 }
      );
    }

    const MAX_ES_LENGTH = 4000;
    const truncatedText = text.length > MAX_ES_LENGTH ? text.slice(0, MAX_ES_LENGTH) : text;

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

    // ✅ OpenAI call
    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
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
        response_format: { type: "json_object" },
        max_tokens: 800,
      }),
    });

    const data = await openaiRes.json();

    if (!openaiRes.ok) {
      console.error("OpenAI API error:", data);
      return NextResponse.json({ ok: false, error: "OpenAI API error", detail: data }, { status: 500 });
    }

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ ok: false, error: "No content from OpenAI" }, { status: 500 });
    }

    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      return NextResponse.json({ ok: false, error: "Failed to parse OpenAI JSON", raw: content }, { status: 500 });
    }

    const s = parsed?.score;
    if (!s || typeof s.structure !== "number" || !parsed.feedback) {
      return NextResponse.json({ ok: false, error: "Invalid JSON shape from OpenAI", raw: parsed }, { status: 500 });
    }

    const avgScore = Math.round((s.structure + s.logic + s.clarity + s.companyFit + s.lengthFit) / 5);

    // ✅ ログ保存（profiles 依存を完全に排除 / user_id 統一）
    // ここが「ログ溜まらない」を直す本丸
    try {
      // es_logs: user_id で保存（profile_id不要）
      const { error: esLogErr } = await supabase.from("es_logs").insert({
        user_id: authUserId,
        company_name: company || null,
        es_question: safeQType,
        es_before: truncatedText,
        es_after: null,
        mode: "eval",
        score: avgScore,
        created_at: new Date().toISOString(), // defaultがあるなら不要
      });

      if (esLogErr) {
        console.error("es_logs insert error:", esLogErr);
      }

      // growth_logs: user_id で保存
      const { error: growthErr } = await supabase.from("growth_logs").insert({
        user_id: authUserId,
        source: "es",
        title: `${company ? `ES評価：${company}` : "ES評価"} [Score]`,
        description: "ESのスコアリングとフィードバックを実施しました。",
        metadata: {
          mode: "eval",
          company: company || null,
          qType: safeQType,
          score: parsed.score,
        },
        created_at: new Date().toISOString(), // defaultがあるなら不要
      });

      if (growthErr) {
        console.error("growth_logs insert error:", growthErr);
      }
    } catch (logErr) {
      console.error("logging error in /api/es/eval:", logErr);
    }

    // ✅ UIに返す
    // 今まで通り parsed を返してOK（互換維持）
    return NextResponse.json(parsed);
  } catch (e) {
    console.error("POST /api/es/eval error:", e);
    return NextResponse.json({ ok: false, error: "Unexpected error" }, { status: 500 });
  }
}
