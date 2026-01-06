// app/api/es/draft/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/utils/supabase/server";
import { requireFeatureOrConsumeMeta } from "@/lib/payment/featureGate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL_ES_BOOST = process.env.OPENAI_MODEL_ES_DRAFT || "gpt-4.1-mini";

const USAGE_FEATURE_KEY = "es_draft";
const GATE_FEATURE_ID = "es_draft";

const ALLOWED_QTYPES = ["self_pr", "gakuchika", "why_company", "why_industry", "other"] as const;
type QuestionType = (typeof ALLOWED_QTYPES)[number];

type BoostRequestBody = {
  storyCardId?: string;
  text?: string;
  company?: string;
  qType?: string;
  limit?: number;
  userId?: string; // あっても無視
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

// story card → ES草案
function buildDraftFromStoryCard(card: any) {
  const situation = String(card?.star_situation ?? "");
  const task = String(card?.star_task ?? "");
  const action = String(card?.star_action ?? "");
  const result = String(card?.star_result ?? "");
  const learnings = String(card?.learnings ?? "");
  return `【結論】${learnings || "（結論）"}

【状況（S）】${situation || "（状況）"}
【課題・役割（T）】${task || "（課題）"}
【行動（A）】${action || "（行動）"}
【結果（R）】${result || "（結果）"}

【この経験から得たこと】${learnings || "（学び）"}`.trim();
}

type BoostResult = {
  score: { structure: number; logic: number; clarity: number; companyFit: number; lengthFit: number };
  boost: {
    strategy: string;
    keyEdits: string[];
    rewrite: string;
    altOpening: string;
    altClosing: string;
  };
};

async function callOpenAIForBoost(input: {
  esText: string;
  company: string;
  qType: QuestionType;
  limit: number;
}): Promise<BoostResult> {
  if (!OPENAI_API_KEY) throw new Error("Missing OPENAI_API_KEY");

  const systemPrompt = `
あなたは外資コンサル・外銀レベルのES添削責任者です。
企業名・設問タイプ・文字数目安・本文を踏まえ、
「通過する書き方」に寄せた高精度リライトを作成してください。
抽象論ではなく、文章の勝ち筋（差別化軸/言い回し/強調点）まで具体に落としてください。
必ずJSON形式だけで返してください。
`.trim();

  const userPrompt = `
【企業名】${input.company}
【設問タイプ】${input.qType}
【文字数目安】${input.limit}文字（±15%）
【本文】：
${input.esText}

要求：
1) score：構成/ロジック/明瞭さ/企業Fit/文字数Fit を10点満点
2) strategy：この企業×設問で刺さる「見せ方の方針」を2〜4文
3) keyEdits：今の本文を“勝ち筋”に寄せる具体編集ポイントを5〜8個（文章レベル）
4) rewrite：同じ内容を保ちつつ、通過確率が上がるように完成版に書き直し（全文）
5) altOpening / altClosing：冒頭と締めの別案（各1〜2文）

返答JSON：
{
  "score": { "structure": number, "logic": number, "clarity": number, "companyFit": number, "lengthFit": number },
  "boost": { "strategy": string, "keyEdits": string[], "rewrite": string, "altOpening": string, "altClosing": string }
}
`.trim();

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_MODEL_ES_BOOST,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.25,
      max_tokens: 1600,
      response_format: { type: "json_object" },
    }),
  });

  const json = await res.json().catch(() => null);

  if (!res.ok) {
    console.error("OpenAI boost error:", res.status, json);
    throw new Error("ESドラフト生成でエラーが発生しました。");
  }

  const content = json?.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAIの返答が空です。");

  let parsed: any;
  try {
    parsed = JSON.parse(content);
  } catch {
    console.error("OpenAI boost parse_error:", content);
    throw new Error("ESドラフトのJSON解析に失敗しました。");
  }

  const s = parsed?.score;
  const b = parsed?.boost;
  if (!s || typeof s.structure !== "number" || !b || typeof b.rewrite !== "string") {
    console.error("OpenAI boost invalid_shape:", parsed);
    throw new Error("ESドラフトの返答形式が不正です。");
  }

  return {
    score: {
      structure: Number(s.structure),
      logic: Number(s.logic),
      clarity: Number(s.clarity),
      companyFit: Number(s.companyFit),
      lengthFit: Number(s.lengthFit),
    },
    boost: {
      strategy: String(b.strategy ?? ""),
      keyEdits: Array.isArray(b.keyEdits) ? b.keyEdits.map(String) : [],
      rewrite: String(b.rewrite ?? ""),
      altOpening: String(b.altOpening ?? ""),
      altClosing: String(b.altClosing ?? ""),
    },
  };
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

    const body = (await req.json().catch(() => null)) as BoostRequestBody | null;
    if (!body) {
      return NextResponse.json({ ok: false, error: "bad_request", message: "Invalid JSON body" }, { status: 400 });
    }

    const storyCardId = safeStr(body.storyCardId, 80);
    const rawText = typeof body.text === "string" ? body.text : "";

    const companyRaw = safeStr(body.company, 100);
    const qTypeRaw = safeStr(body.qType, 50);
    const qType: QuestionType =
      (ALLOWED_QTYPES as readonly string[]).includes(qTypeRaw) ? (qTypeRaw as QuestionType) : "other";
    const limit = clampInt(body.limit, 200, 2000, 400);

    if (!storyCardId && rawText.trim().length < 30) {
      return NextResponse.json(
        { ok: false, error: "bad_request", message: "storyCardId か text（30文字以上）が必要です。" },
        { status: 400 }
      );
    }

    // =========================
    // ✅ gate（usage → need_meta → meta消費）※サーバが最終真実
    // =========================
    const baseUrl = new URL(req.url).origin;
    const cookieHeader = req.headers.get("cookie") ?? "";

    const usageRes = await fetch(`${baseUrl}/api/usage/consume`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieHeader },
      body: JSON.stringify({ feature: USAGE_FEATURE_KEY }),
    });

    const usageJson = await usageRes.json().catch(() => null);

    if (!usageRes.ok) {
      if (usageRes.status === 402 && usageJson?.error === "need_meta") {
        const gate = await requireFeatureOrConsumeMeta(GATE_FEATURE_ID as any);
        if (!gate.ok) return NextResponse.json(gate, { status: gate.status });
      } else {
        console.error("usage/consume error:", usageRes.status, usageJson);
        return NextResponse.json({ ok: false, error: "usage_error", message: "Failed to check usage" }, { status: 500 });
      }
    }

    // =========================
    // ✅ 入力ES本文を確定（カード or 直接本文）
    // =========================
    let baseText = rawText.trim();
    let usedStoryCard: any = null;

    if (storyCardId) {
      const { data: card, error: cardErr } = await supabase
        .from("story_cards")
        .select("*")
        .eq("id", storyCardId)
        .eq("user_id", userId)
        .maybeSingle();

      if (cardErr) {
        console.error("story_cards fetch error:", cardErr);
        return NextResponse.json({ ok: false, error: "story_card_fetch_failed" }, { status: 500 });
      }
      if (!card) {
        return NextResponse.json({ ok: false, error: "not_found", message: "story card not found" }, { status: 404 });
      }

      usedStoryCard = card;
      if (!baseText) baseText = buildDraftFromStoryCard(card);
    }

    const MAX_ES_LENGTH = 4000;
    const truncatedText = baseText.length > MAX_ES_LENGTH ? baseText.slice(0, MAX_ES_LENGTH) : baseText;

    // =========================
    // ✅ OpenAI（高精度ドラフト：全文）
    // =========================
    const result = await callOpenAIForBoost({
      esText: truncatedText,
      company: companyRaw,
      qType,
      limit,
    });

    const rewriteFull = String(result.boost.rewrite ?? "").trim();

    const nowIso = new Date().toISOString();
    const avg = avgScore5(result.score);
    const avgScore = Number.isFinite(avg as any) ? (avg as number) : 0;

    const safeCompany = companyRaw?.trim() ? companyRaw.trim() : "（未指定）";
    const safeMode = "draft";

    // =========================
    // ✅ 保存：es_logs（履歴）…全文を保存
    // =========================
    try {
      const { error } = await supabase.from("es_logs").insert({
        user_id: userId,
        profile_id: userId,
        company_name: safeCompany,
        es_question: qType,
        mode: safeMode,
        score: avgScore,
        es_before: truncatedText,
        es_after: rewriteFull,
        created_at: nowIso,
      });

      if (error) console.error("es_logs insert error (es/draft):", error);
    } catch (e) {
      console.error("es_logs insert crash (es/draft):", e);
    }

    // =========================
    // ✅ 保存：es_corrections（成果物）…全文を保存
    // =========================
    try {
      const { error: corrErr } = await supabase.from("es_corrections").insert({
        user_id: userId,
        profile_id: userId,
        story_card_id: storyCardId || null,
        company_name: safeCompany,
        question: qType,
        original_text: truncatedText,
        ai_feedback: {
          score: result.score,
          boost: {
            strategy: result.boost.strategy,
            keyEdits: result.boost.keyEdits,
            altOpening: result.boost.altOpening,
            altClosing: result.boost.altClosing,
          },
          meta: {
            mode: "draft",
            company: safeCompany,
            qType,
            limit,
            model: OPENAI_MODEL_ES_BOOST,
            storyCardId: storyCardId || null,
          },
        },
        ai_rewrite: rewriteFull,
        created_at: nowIso,
      });

      if (corrErr) console.error("es_corrections insert error (es/draft):", corrErr);
    } catch (e) {
      console.error("es_corrections insert crash (es/draft):", e);
    }

    // =========================
    // ✅ 保存：es_templates（任意）
    // =========================
    try {
      const safeRole = "（未指定）";
      const { error: tmplErr } = await supabase.from("es_templates").insert({
        user_id: userId,
        profile_id: userId,
        company_name: safeCompany,
        role_name: safeRole,
        question: qType,
        base_draft: truncatedText,
        is_default: false,
        created_at: nowIso,
        updated_at: nowIso,
      });

      if (tmplErr) console.error("es_templates insert error (es/draft):", tmplErr);
    } catch (e) {
      console.error("es_templates insert crash (es/draft):", e);
    }

    // =========================
    // ✅ growth_logs（任意）
    // =========================
    try {
      await supabase.from("growth_logs").insert({
        user_id: userId,
        source: "es_draft",
        title: safeCompany !== "（未指定）" ? `ESドラフト：${safeCompany}` : "ESドラフト",
        description: "企業×設問×本文から、高精度のドラフト（戦略＋リライト）を生成しました。",
        metadata: {
          feature: GATE_FEATURE_ID,
          mode: "draft",
          company: safeCompany,
          qType,
          limit,
          story_card_id: storyCardId || null,
          scores: result.score,
        },
        created_at: nowIso,
      });
    } catch (e) {
      console.error("growth_logs insert error (es/draft):", e);
    }

    // ✅ 返却：全文のみ
    return NextResponse.json({
      ok: true,
      usedThisMonth: typeof usageJson?.usedThisMonth === "number" ? usageJson.usedThisMonth : null,
      freeLimit: typeof usageJson?.freeLimit === "number" ? usageJson.freeLimit : null,

      score: result.score,
      strategy: result.boost.strategy,
      keyEdits: result.boost.keyEdits,
      altOpening: result.boost.altOpening,
      altClosing: result.boost.altClosing,

      draft: rewriteFull,
    });
  } catch (e) {
    console.error("POST /api/es/draft error:", e);
    return NextResponse.json({ ok: false, error: "es_draft_failed" }, { status: 500 });
  }
}
