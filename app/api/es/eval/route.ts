// app/api/es/eval/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/utils/supabase/server";
import { getUserPlan } from "@/lib/plan";
import { requireFeatureOrConsumeMeta } from "@/lib/payment/featureGate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL_ES = process.env.OPENAI_MODEL_EVAL_ES || "gpt-4.1-mini";

// ✅ usage側（/api/usage/consume に合わせる）
const USAGE_FEATURE_KEY = "es_correction";
// ✅ featureGate側（FEATURE_META_COST のキー）
const GATE_FEATURE_ID = "es_correction";

const ALLOWED_QTYPES = ["self_pr", "gakuchika", "why_company", "why_industry", "other"] as const;
type QuestionType = (typeof ALLOWED_QTYPES)[number];

type EvalRequestBody = {
  text?: string;
  company?: string;
  qType?: string;
  limit?: number;

  // 互換：送られてきても無視
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
function avgScore5(s: any) {
  const arr = [s?.structure, s?.logic, s?.clarity, s?.companyFit, s?.lengthFit].map((x) => Number(x));
  if (arr.some((x) => !Number.isFinite(x))) return null;
  const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
  return Math.round(avg);
}

export async function POST(req: NextRequest) {
  try {
    if (!OPENAI_API_KEY) {
      return NextResponse.json(
        { ok: false, error: "server_config", message: "Missing OPENAI_API_KEY" },
        { status: 500 }
      );
    }

    // ✅ cookieセッションから本人確定
    const supabase = await createServerSupabase();
    const { data: auth, error: authErr } = await supabase.auth.getUser();
    const user = auth?.user ?? null;

    if (authErr || !user?.id) {
      return NextResponse.json({ ok: false, error: "unauthorized", message: "login required" }, { status: 401 });
    }
    const userId = user.id;

    const body = (await req.json().catch(() => null)) as EvalRequestBody | null;
    if (!body) {
      return NextResponse.json({ ok: false, error: "bad_request", message: "Invalid JSON body" }, { status: 400 });
    }

    const text = typeof body.text === "string" ? body.text : "";
    const companyRaw = safeStr(body.company, 100);
    const qTypeRaw = safeStr(body.qType, 50);
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

    // ✅ usage/consume（Cookie転送）
    const baseUrl = new URL(req.url).origin;
    const cookieHeader = req.headers.get("cookie") ?? "";

    const usageRes = await fetch(`${baseUrl}/api/usage/consume`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieHeader },
      body: JSON.stringify({ feature: USAGE_FEATURE_KEY }),
    });

    const usageJson = await usageRes.json().catch(() => null);

    // ✅ 無料枠超え → meta消費（唯一の消費場所）
    if (!usageRes.ok) {
      if (usageRes.status === 402 && usageJson?.error === "need_meta") {
        const gate = await requireFeatureOrConsumeMeta(GATE_FEATURE_ID);
        if (!gate.ok) return NextResponse.json(gate, { status: gate.status });
      } else {
        console.error("usage/consume error:", usageRes.status, usageJson);
        return NextResponse.json({ ok: false, error: "usage_error", message: "Failed to check usage" }, { status: 500 });
      }
    }

    const plan = await getUserPlan(userId);

    // =========================
    // ✅ ここから「採点が振れる」プロンプトに変更（差し替え）
    // =========================
    const systemPrompt = `
あなたは日本の就活に詳しいES添削のプロフェッショナルです。
与えられたESを、採用担当者の視点で厳密かつ公平に評価してください。

【評価ルール（重要）】
- 各項目は必ず 1〜10 点の整数で評価してください。
- 無難に 7 点を付けることを避け、内容に応じて明確に差をつけてください。
- 全体的に完成度が低い場合は 4〜5 点、高い場合は 8〜9 点を積極的に使用してください。
- 10 点は「ほぼそのまま通過レベル」の場合のみ使用してください。

【各スコアの観点】
- structure：結論→理由→具体例→学び の流れが明確か
- logic：主張と行動・結果の因果関係が論理的か
- clarity：一文が長すぎず、読み手に負担をかけていないか
- companyFit：企業・業界・職種との具体的な接続があるか
- lengthFit：指定文字数に対して過不足なく情報が収まっているか

必ず指定されたJSON形式のみで返答してください。
`.trim();

    const userPrompt = `
以下は就活ESの回答です。
構成・ロジック・分かりやすさ・企業フィット・文字数フィットの5項目について、
それぞれ10点満点で厳密に評価し、具体的なフィードバックを作成してください。

【企業名】:${companyRaw}
【設問タイプ】:${safeQType}
【文字数目安】:${safeLimit} 文字

【ES本文】
${truncatedText}

【企業フィット評価基準（特に重要）】
- 9〜10点：企業の事業内容・価値観・職種に具体的に結びついており、企業名を変えると成立しない
- 7〜8点：企業固有の要素に触れているが、やや一般化できる余地がある
- 5〜6点：内容は良いが、どの企業にも当てはまりそう
- 4点以下：企業との接点がほとんど見られない

【注意】
- 内容が弱い場合に 7 点で固定することは禁止です。
- 各スコアは必ず理由を持って判断してください。

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
`.trim();
    // =========================
    // ✅ ここまで差し替え
    // =========================

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
    if (!content) return NextResponse.json({ ok: false, error: "openai_empty" }, { status: 500 });

    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      return NextResponse.json({ ok: false, error: "parse_error", raw: content }, { status: 500 });
    }

    const s = parsed?.score;
    const f = parsed?.feedback;
    if (!s || typeof s.structure !== "number" || !f) {
      return NextResponse.json({ ok: false, error: "invalid_shape", raw: parsed }, { status: 500 });
    }

    const nowIso = new Date().toISOString();
    const avg = avgScore5(s);
    const avgScore = Number.isFinite(avg as any) ? (avg as number) : 0;

    // ✅ null禁止寄せ
    const safeCompany = companyRaw?.trim() ? companyRaw.trim() : "（未指定）";
    const safeMode = "eval";

    // 一覧で見やすいように summary+要点を軽く整形（全部埋める）
    const afterText = [
      `【要約】${String(f?.summary ?? "").trim()}`,
      "",
      `【強み】${Array.isArray(f?.strengths) ? f.strengths.join(" / ") : ""}`,
      `【改善】${Array.isArray(f?.improvements) ? f.improvements.join(" / ") : ""}`,
    ]
      .filter(Boolean)
      .join("\n");

    // =========================
    // ✅ 保存：es_logs のみ
    // =========================
    try {
      const { error: logErr } = await supabase.from("es_logs").insert({
        user_id: userId,
        profile_id: userId,
        company_name: safeCompany,
        es_question: safeQType, // 今は qType を入れる（将来は設問本文へ）
        mode: safeMode,
        score: avgScore,
        es_before: truncatedText,
        es_after: afterText,
        created_at: nowIso,
      });

      if (logErr) console.error("es_logs insert error (es/eval):", logErr);
    } catch (e) {
      console.error("es_logs insert crash (es/eval):", e);
    }

    // =========================
    // ✅ growth_logs（任意）
    // =========================
    try {
      const titleBase = safeCompany !== "（未指定）" ? `ES評価：${safeCompany}` : "ES評価";
      await supabase.from("growth_logs").insert({
        user_id: userId,
        source: "es_correction",
        title: `${titleBase} [Score]`,
        description: "ESのスコアリングとフィードバックを生成しました。",
        metadata: {
          mode: "eval",
          feature: GATE_FEATURE_ID,
          company: safeCompany,
          qType: safeQType,
          limit: safeLimit,
          model: OPENAI_MODEL_ES,
          scores: {
            structure: s.structure,
            logic: s.logic,
            clarity: s.clarity,
            companyFit: s.companyFit,
            lengthFit: s.lengthFit,
          },
        },
        created_at: nowIso,
      });
    } catch (e) {
      console.error("growth_logs insert error (es/eval):", e);
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
