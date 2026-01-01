// app/api/es/draft/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/utils/supabase/server";
import { requireFeatureOrConsumeMeta } from "@/lib/payment/featureGate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL_ES_DRAFT = process.env.OPENAI_MODEL_ES_DRAFT || "gpt-4.1-mini";

// ✅ usage側 / featureGate側で同じキーに揃える
// - usage/consume に渡す feature
const USAGE_FEATURE_KEY = "es_draft";
// - featureGate の FeatureId（FEATURE_META_COST のキー）
const GATE_FEATURE_ID = "es_draft";

type DraftRequestBody = {
  storyCardId?: string;
};

function safeStr(v: unknown, maxLen: number) {
  if (typeof v !== "string") return "";
  return v.slice(0, maxLen);
}

async function callOpenAI(card: any) {
  const prompt = `
以下は就活用のSTARカードです。
この内容を基に「400〜600字のESドラフト」を日本語で作成してください。

必ず以下の構成を含めてください：
- 結論（この経験を一言で言うと？）
- S（状況）
- T（課題）
- A（行動）
- R（結果）
- この経験から得た強みと一言まとめ

返答は必ずJSONで：
{ "draft": "..." }

=== STARカード ===
${JSON.stringify(card, null, 2)}
`.trim();

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_MODEL_ES_DRAFT,
      messages: [
        { role: "system", content: "あなたは就活ES文章を精密に作るプロの添削者です。" },
        { role: "user", content: prompt },
      ],
      temperature: 0.4,
      max_tokens: 900,
      response_format: { type: "json_object" },
    }),
  });

  const json = await res.json().catch(() => null);

  if (!res.ok) {
    console.error("OpenAI draft error:", res.status, json);
    throw new Error("ESドラフト生成でエラーが発生しました。");
  }

  const content = json?.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAIの返答が空です。");

  try {
    const parsed = JSON.parse(content);
    const draft = typeof parsed?.draft === "string" ? parsed.draft : "";
    return draft;
  } catch {
    // 万一 JSON じゃない返りでも落とさず返す（保険）
    return String(content);
  }
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
      return NextResponse.json(
        { ok: false, error: "unauthorized", message: "login required" },
        { status: 401 }
      );
    }
    const userId = user.id;

    const body = (await req.json().catch(() => null)) as DraftRequestBody | null;
    if (!body) {
      return NextResponse.json(
        { ok: false, error: "bad_request", message: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const storyCardId = safeStr(body.storyCardId, 80);
    if (!storyCardId) {
      return NextResponse.json(
        { ok: false, error: "bad_request", message: "storyCardId is required" },
        { status: 400 }
      );
    }

    // ✅ 自分のカードしか取れない
    const { data: card, error: cardErr } = await supabase
      .from("story_cards")
      .select("*")
      .eq("id", storyCardId)
      .eq("user_id", userId)
      .maybeSingle();

    if (cardErr) {
      console.error("story_cards fetch error:", cardErr);
      return NextResponse.json(
        { ok: false, error: "story_card_fetch_failed" },
        { status: 500 }
      );
    }
    if (!card) {
      return NextResponse.json(
        { ok: false, error: "not_found", message: "story card not found" },
        { status: 404 }
      );
    }

    // =========================
    // ✅ gate（他と同じ型）
    // =========================
    // ① 無料枠チェック（usage）
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

    // ② 無料枠NG → meta消費（唯一の消費場所）
    if (!usageRes.ok) {
      if (usageRes.status === 402 && usageJson?.error === "need_meta") {
        const gate = await requireFeatureOrConsumeMeta(GATE_FEATURE_ID as any);
        if (!gate.ok) return NextResponse.json(gate, { status: gate.status });
        // gate.ok => meta消費済み
      } else {
        console.error("usage/consume error:", usageRes.status, usageJson);
        return NextResponse.json(
          { ok: false, error: "usage_error", message: "Failed to check usage" },
          { status: 500 }
        );
      }
    }

    // ✅ OpenAI 実行
    const draft = await callOpenAI(card);

    // ✅ ログ（任意）
    try {
      await supabase.from("growth_logs").insert({
        user_id: userId,
        source: "es",
        title: "ESドラフト生成",
        description: "STARカードからESドラフトを生成しました。",
        metadata: { story_card_id: storyCardId, feature: GATE_FEATURE_ID },
      });
    } catch (e) {
      console.error("growth_logs insert error (es/draft):", e);
    }

    return NextResponse.json({
      ok: true,
      usedThisMonth: typeof usageJson?.usedThisMonth === "number" ? usageJson.usedThisMonth : null,
      freeLimit: typeof usageJson?.freeLimit === "number" ? usageJson.freeLimit : null,
      draft,
    });
  } catch (e) {
    console.error("/api/es/draft error:", e);
    return NextResponse.json(
      { ok: false, error: "es_draft_failed" },
      { status: 500 }
    );
  }
}
