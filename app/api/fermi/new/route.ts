// app/api/fermi/new/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/utils/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL_GEN = process.env.OPENAI_MODEL_GEN_FERMI || "gpt-4o-mini";

type FermiCategory = "daily" | "business" | "consulting";
type FermiDifficulty = "easy" | "medium" | "hard";

type FeatureId = "fermi_generate";
type ProceedMode = "unlimited" | "free" | "need_meta";

function safeJsonParseStrict(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    const m = s.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("Invalid JSON from model");
    return JSON.parse(m[0]);
  }
}

function clampInt(n: unknown, min: number, max: number, fallback: number) {
  const x = Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(x)));
}

export async function POST(req: NextRequest) {
  try {
    if (!OPENAI_API_KEY) {
      return NextResponse.json(
        { ok: false, error: "server_config", message: "OPENAI_API_KEY is not set" },
        { status: 500 }
      );
    }

    const supabase = await createServerSupabase();
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user?.id) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
    const authUserId = user.id;

    const body = (await req.json().catch(() => null)) as
      | {
          category?: FermiCategory;
          difficulty?: FermiDifficulty;
          idempotencyKey?: string;
          count?: number;
        }
      | null;

    const category = body?.category;
    const difficulty = body?.difficulty;
    const idempotencyKey = String(body?.idempotencyKey ?? "").trim();
    const count = clampInt(body?.count, 1, 50, 1); // 1〜50

    if (!category || !difficulty || !idempotencyKey) {
      return NextResponse.json(
        { ok: false, error: "bad_request", message: "category/difficulty/idempotencyKey is required" },
        { status: 400 }
      );
    }

    const feature: FeatureId = "fermi_generate";

    // 既存job確認（reused / running復帰）
    const existing = await supabase
      .from("generation_jobs")
      .select("*")
      .eq("auth_user_id", authUserId)
      .eq("feature_id", feature)
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

    if (existing.data?.status === "succeeded" && existing.data?.result) {
      const r = existing.data.result ?? {};
      return NextResponse.json({
        ok: true,
        ...(r || {}),
        jobId: existing.data.id,
        idempotencyKey,
        reused: true,
      });
    }

    if (existing.data?.status === "running" || existing.data?.status === "queued") {
      return NextResponse.json({
        ok: true,
        status: existing.data.status,
        jobId: existing.data.id,
        idempotencyKey,
        reused: true,
      });
    }

    // usage/check（最優先）
    const baseUrl = new URL(req.url).origin;
    const cookieHeader = req.headers.get("cookie") ?? "";
    const metaConfirmHeader = req.headers.get("x-meta-confirm"); // ✅ 追加（evalと同じ）

    const checkHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      Cookie: cookieHeader,
    };
    if (metaConfirmHeader) checkHeaders["X-Meta-Confirm"] = metaConfirmHeader; // ✅ 追加

    const checkRes = await fetch(`${baseUrl}/api/usage/check`, {
      method: "POST",
      headers: checkHeaders,
      body: JSON.stringify({ feature }),
    });

    const checkBody: any = await checkRes.json().catch(() => ({}));

    if (!checkRes.ok) {
      if (checkRes.status === 402 && checkBody?.error === "need_meta") {
        const requiredMeta = Number(checkBody?.requiredMeta ?? 1);
        return NextResponse.json(
          { ok: false, error: "need_meta", requiredMeta },
          { status: 402 }
        );
      }
      if (checkRes.status === 401) {
        return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
      }
      console.error("usage/check unexpected", checkRes.status, checkBody);
      return NextResponse.json({ ok: false, error: "usage_error" }, { status: 500 });
    }

    const proceedMode: ProceedMode = (checkBody?.mode ?? "free") as ProceedMode;

    // job upsert(running)
    const up = await supabase
      .from("generation_jobs")
      .upsert(
        {
          auth_user_id: authUserId,
          feature_id: feature,
          idempotency_key: idempotencyKey,
          status: "running",
          request: { category, difficulty, count },
          result: null,
          error_code: null,
          error_message: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "auth_user_id,feature_id,idempotency_key" }
      )
      .select("*")
      .single();

    if (up.error || !up.data?.id) {
      console.error("generation_jobs upsert error:", up.error);
      return NextResponse.json({ ok: false, error: "db_error" }, { status: 500 });
    }

    const jobId = up.data.id as string;

    // OpenAI（json_object）
    const system = `
あなたはフェルミ推定の出題者。日本語。
必ずJSONのみで返す（前後に文章を付けない）。
`.trim();

    const userPrompt = `
category: ${category}
difficulty: ${difficulty}
count: ${count}

次のJSONでフェルミ問題を ${count} 個生成して（配列で返す）：
{
  "fermis": [
    {
      "id": "一意っぽいid（英数字と-や_）",
      "category": "${category}",
      "difficulty": "${difficulty}",
      "title": "お題（日本語）",
      "formulaHint": "例：人口 × 利用割合 × 年間回数 × 単価",
      "defaultFactors": ["要因1","要因2","要因3","要因4"],
      "unit": "円 / 年 など"
    }
  ]
}

ルール：
- fermis は必ず ${count} 個
- defaultFactorsは各問題ごとに3〜5個
- 問題タイトルは互いに被らない（言い換えも避ける）
- business/consulting は数字が置きやすいテーマ
- daily は日常の推定
- 難易度の目安：
  easy: 3要因中心、単位も素直
  medium: 4要因中心、分解の自由度あり
  hard: 5要因中心、セグメント分け（例：都市/地方、年齢層など）を促す
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
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!r.ok) {
      const t = await r.text().catch(() => "");
      console.error("OpenAI error:", t);

      await supabase
        .from("generation_jobs")
        .update({
          status: "failed",
          error_code: "openai_error",
          error_message: "OpenAI API error",
          updated_at: new Date().toISOString(),
        })
        .eq("auth_user_id", authUserId)
        .eq("feature_id", feature)
        .eq("idempotency_key", idempotencyKey);

      return NextResponse.json(
        { ok: false, error: "openai_error", message: "OpenAI API error" },
        { status: 500 }
      );
    }

    const j = await r.json().catch(() => null);
    const content = j?.choices?.[0]?.message?.content ?? "";

    let obj: any;
    try {
      obj = safeJsonParseStrict(content);
    } catch (e) {
      console.error(e);

      await supabase
        .from("generation_jobs")
        .update({
          status: "failed",
          error_code: "json_parse_error",
          error_message: "Failed to parse model JSON",
          updated_at: new Date().toISOString(),
        })
        .eq("auth_user_id", authUserId)
        .eq("feature_id", feature)
        .eq("idempotency_key", idempotencyKey);

      return NextResponse.json(
        { ok: false, error: "json_parse_error", message: "Failed to parse model JSON" },
        { status: 500 }
      );
    }

    const fermis = Array.isArray(obj?.fermis) ? obj.fermis : [];
    if (!fermis.length) {
      await supabase
        .from("generation_jobs")
        .update({
          status: "failed",
          error_code: "invalid_payload",
          error_message: "Model returned empty fermis",
          updated_at: new Date().toISOString(),
        })
        .eq("auth_user_id", authUserId)
        .eq("feature_id", feature)
        .eq("idempotency_key", idempotencyKey);

      return NextResponse.json(
        { ok: false, error: "invalid_payload", message: "Model returned empty fermis" },
        { status: 500 }
      );
    }

    // generation_jobs に結果保存（成功判定）
    const resultObj = {
      plan: (checkBody?.plan ?? "free") as any,
      // ✅ 互換：単体も残す
      fermi: fermis[0],
      // ✅ 新仕様：複数
      fermis,
    };

    const save = await supabase
      .from("generation_jobs")
      .update({
        status: "succeeded",
        result: resultObj,
        error_code: null,
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq("auth_user_id", authUserId)
      .eq("feature_id", feature)
      .eq("idempotency_key", idempotencyKey)
      .select("id")
      .single();

    if (save.error) {
      console.error("result_save_failed:", save.error);
      await supabase
        .from("generation_jobs")
        .update({
          status: "failed",
          error_code: "result_save_failed",
          error_message: "Failed to save result",
          updated_at: new Date().toISOString(),
        })
        .eq("auth_user_id", authUserId)
        .eq("feature_id", feature)
        .eq("idempotency_key", idempotencyKey);

      return NextResponse.json(
        { ok: false, error: "result_save_failed", message: "Failed to save result" },
        { status: 500 }
      );
    }

    // 成功後のみ課金（freeのみ）
    if (proceedMode === "free") {
      await fetch(`${baseUrl}/api/usage/log`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookieHeader },
        body: JSON.stringify({ feature }),
      }).catch(() => {});
    }

    return NextResponse.json({
      ok: true,
      ...resultObj,
      jobId,
      idempotencyKey,
      reused: false,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
