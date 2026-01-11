// app/api/eval/fermi/route.ts
import { NextResponse } from "next/server";
import { createServerSupabase } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL_EVAL = process.env.OPENAI_MODEL_EVAL_FERMI || "gpt-4o-mini";

type FeatureId = "fermi";

type FermiFactor = {
  id: number;
  name: string;
  operator: "×" | "+";
  assumption: string;
  rationale: string;
  value: string;
};

type ProceedMode = "unlimited" | "free" | "need_meta";

function clamp0to10(n: any) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(10, Math.round(x)));
}

function safeJsonParseStrict(s: string) {
  // response_format:json_object を前提に「JSON.parseのみ」へ寄せる
  // それでも壊れることはあるので、保険で {...} 抜き出しは残す
  try {
    return JSON.parse(s);
  } catch {
    const m = s.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("Invalid JSON from model");
    return JSON.parse(m[0]);
  }
}

function pickMetaConfirm(req: Request) {
  return (
    req.headers.get("x-meta-confirm") === "1" ||
    req.headers.get("X-Meta-Confirm") === "1"
  );
}

type EvalRequestBody = {
  idempotencyKey?: string;
  question: string;
  formula: string;
  unit: string;
  factors: FermiFactor[];
  sanityComment?: string;
  result?: string;
  problemId?: string | null;
  category?: string;
  difficulty?: string;
};

type GenerationJob = {
  id: string;
  auth_user_id: string;
  feature_id: string;
  idempotency_key: string;
  status: "queued" | "running" | "succeeded" | "failed";
  request: any;
  result: any;
  error_code: string | null;
  error_message: string | null;
  log_id: string | null;
  created_at: string;
  updated_at: string;
};

async function markJobFailed(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  authUserId: string,
  feature: FeatureId,
  idempotencyKey: string,
  code: string,
  message: string
) {
  await supabase
    .from("generation_jobs")
    .update({
      status: "failed",
      error_code: code,
      error_message: message,
      updated_at: new Date().toISOString(),
    })
    .eq("auth_user_id", authUserId)
    .eq("feature_id", feature)
    .eq("idempotency_key", idempotencyKey);
}

export async function POST(req: Request) {
  try {
    if (!OPENAI_API_KEY) {
      return NextResponse.json(
        { ok: false, error: "server_config", message: "OPENAI_API_KEY is not set" },
        { status: 500 }
      );
    }

    // ✅ auth（cookieセッション）
    const supabase = await createServerSupabase();
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user?.id) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
    const authUserId = user.id;

    const metaConfirm = pickMetaConfirm(req);

    const body = (await req.json().catch(() => null)) as EvalRequestBody | null;
    if (!body) {
      return NextResponse.json(
        { ok: false, error: "bad_request", message: "invalid json" },
        { status: 400 }
      );
    }

    const feature: FeatureId = "fermi";
    const idempotencyKey = String(body.idempotencyKey || "").trim();

    if (!idempotencyKey) {
      return NextResponse.json(
        { ok: false, error: "bad_request", message: "idempotencyKey is required" },
        { status: 400 }
      );
    }

    const { question, formula, unit, factors, sanityComment } = body;

    if (!question || !formula || !unit || !Array.isArray(factors)) {
      return NextResponse.json(
        { ok: false, error: "bad_request", message: "question/formula/unit/factors is required" },
        { status: 400 }
      );
    }

    // =========================
    // ✅ 0) 既存job確認（reused / running復帰）
    // =========================
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

    // =========================
    // ✅ 1) usage/check（最優先・消費しない）
    // =========================
    const baseUrl = new URL(req.url).origin;
    const cookieHeader = req.headers.get("cookie") ?? "";

    const checkRes = await fetch(`${baseUrl}/api/usage/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieHeader },
      body: JSON.stringify({ feature }),
    });

    const checkBody: any = await checkRes.json().catch(() => ({}));

    // 402 need_meta（残高不足等）→ metaConfirm=trueでも必ず止める（固定仕様）
    if (!checkRes.ok) {
      if (checkRes.status === 402 && checkBody?.error === "need_meta") {
        const requiredMeta = Number(checkBody?.requiredMeta ?? 1);

        // job は「実行前に upsert(running)」が仕様なので、ここは upsert して failed に落とす（最小限）
        await supabase
          .from("generation_jobs")
          .upsert(
            {
              auth_user_id: authUserId,
              feature_id: feature,
              idempotency_key: idempotencyKey,
              status: "failed",
              request: body,
              result: null,
              error_code: "need_meta",
              error_message: "METAが不足しています。",
              updated_at: new Date().toISOString(),
            },
            { onConflict: "auth_user_id,feature_id,idempotency_key" }
          )
          .select("id")
          .maybeSingle();

        return NextResponse.json(
          { ok: false, error: "need_meta", requiredMeta },
          { status: 402 }
        );
      }

      if (checkRes.status === 401) {
        return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
      }

      console.error("usage/check unexpected", checkRes.status, checkBody);
      return NextResponse.json(
        { ok: false, error: "usage_error", message: "Failed to check usage" },
        { status: 500 }
      );
    }

    const proceedMode: ProceedMode = (checkBody?.mode ?? "free") as ProceedMode;
    const requiredMeta = Number(checkBody?.requiredMeta ?? 1);

    // mode=need_meta の場合：confirm前は 402 で止める（固定仕様）
    if (proceedMode === "need_meta" && !metaConfirm) {
      // upsert(running) → すぐ止める（最小限：runningのままにせず failed）
      await supabase
        .from("generation_jobs")
        .upsert(
          {
            auth_user_id: authUserId,
            feature_id: feature,
            idempotency_key: idempotencyKey,
            status: "failed",
            request: body,
            result: null,
            error_code: "need_meta",
            error_message: "META確認が必要です。",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "auth_user_id,feature_id,idempotency_key" }
        )
        .select("id")
        .maybeSingle();

      return NextResponse.json(
        { ok: false, error: "need_meta", requiredMeta },
        { status: 402 }
      );
    }

    // =========================
    // ✅ 2) generation_jobs upsert(running)（固定仕様）
    // =========================
    const up = await supabase
      .from("generation_jobs")
      .upsert(
        {
          auth_user_id: authUserId,
          feature_id: feature,
          idempotency_key: idempotencyKey,
          status: "running",
          request: body,
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
      return NextResponse.json(
        { ok: false, error: "db_error", message: "Failed to create job" },
        { status: 500 }
      );
    }

    const jobId = (up.data as GenerationJob).id;

    // =========================
    // ✅ 3) OpenAI（response_format json_object）
    // =========================
    const system = `
あなたはフェルミ推定の面接官。日本語で辛口だが建設的。
必ずJSONのみで返す（前後に文章を付けない）。
スコアは0〜10の整数（5軸）。totalScoreは5軸の合計（0〜50）。
strengths/weaknessesは配列（3〜6個）。
sampleAnswerは「短い模範（手順＋代表値＋結論）」を示す。
`.trim();

    const userPrompt = `
【お題】
${question}

【式】
${formula}

【単位】
${unit}

【要因】
${JSON.stringify(factors, null, 2)}

【Sanity Check コメント】
${sanityComment || "(なし)"}

【出力JSONスキーマ（厳守）】
{
  "score": {
    "reframing": 0-10,
    "decomposition": 0-10,
    "assumptions": 0-10,
    "numbersSense": 0-10,
    "sanityCheck": 0-10
  },
  "feedback": {
    "summary": "2〜4行",
    "strengths": ["..."],
    "weaknesses": ["..."],
    "advice": "1〜3行",
    "sampleAnswer": "短い模範回答（改行OK）",
    "totalScore": 0-50
  }
}
`.trim();

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENAI_MODEL_EVAL,
        temperature: 0.2,
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
      await markJobFailed(supabase, authUserId, feature, idempotencyKey, "openai_error", "OpenAI API error");
      return NextResponse.json(
        { ok: false, error: "openai_error", message: "OpenAI API error" },
        { status: 500 }
      );
    }

    const j = await r.json().catch(() => null);
    const content = j?.choices?.[0]?.message?.content ?? "";

    let parsed: any;
    try {
      parsed = safeJsonParseStrict(content);
    } catch (e: any) {
      console.error("JSON parse failed:", e);
      await markJobFailed(
        supabase,
        authUserId,
        feature,
        idempotencyKey,
        "json_parse_error",
        "モデル出力のJSON解析に失敗しました。"
      );
      return NextResponse.json(
        { ok: false, error: "json_parse_error", message: "Failed to parse model JSON" },
        { status: 500 }
      );
    }

    const s = parsed?.score ?? {};
    const fb = parsed?.feedback ?? {};

    const score = {
      reframing: clamp0to10(s.reframing),
      decomposition: clamp0to10(s.decomposition),
      assumptions: clamp0to10(s.assumptions),
      numbersSense: clamp0to10(s.numbersSense),
      sanityCheck: clamp0to10(s.sanityCheck),
    };

    const totalScore =
      score.reframing +
      score.decomposition +
      score.assumptions +
      score.numbersSense +
      score.sanityCheck;

    const feedback = {
      summary: String(fb.summary ?? ""),
      strengths: Array.isArray(fb.strengths) ? fb.strengths.map(String) : [],
      weaknesses: Array.isArray(fb.weaknesses) ? fb.weaknesses.map(String) : [],
      advice: String(fb.advice ?? ""),
      sampleAnswer: String(fb.sampleAnswer ?? ""),
      totalScore,
    };

    // =========================
    // ✅ 4) fermi_sessions へ保存（従来通り）→ logId を job.log_id にも入れる
    // =========================
    const insertPayload: any = {
      user_id: authUserId,
      problem_id: body.problemId ?? null,
      category: body.category ?? null,
      difficulty: body.difficulty ?? null,

      total_score: totalScore,
      reframing: score.reframing,
      decomposition: score.decomposition,
      assumptions: score.assumptions,
      numbers_sense: score.numbersSense,
      sanity_check: score.sanityCheck,

      payload: {
        question,
        formula,
        unit,
        factors,
        sanityComment: sanityComment ?? null,
        result: body.result ?? null,
        feedback,
      },
    };

    // A: RLSでinsert
    let insertRes = await supabase
      .from("fermi_sessions")
      .insert(insertPayload)
      .select("id")
      .single();

    // B: 保険（既存運用のまま）
    if (insertRes.error) {
      console.error("fermi_sessions insert error (authed):", insertRes.error);
      insertRes = await supabaseAdmin
        .from("fermi_sessions")
        .insert(insertPayload)
        .select("id")
        .single();

      if (insertRes.error) {
        console.error("fermi_sessions insert error (admin):", insertRes.error);
      }
    }

    const logId = insertRes.data?.id ?? null;

    // =========================
    // ✅ 5) generation_jobs に result 保存（成功判定はここ）
    // =========================
    const resultObj = {
      plan: (checkBody?.plan ?? "free") as any, // 既存互換（plan表示があれば）
      score,
      feedback,
      totalScore,
      logId,
    };

    const saveRes = await supabase
      .from("generation_jobs")
      .update({
        status: "succeeded",
        result: resultObj,
        error_code: null,
        error_message: null,
        log_id: logId ? String(logId) : null,
        updated_at: new Date().toISOString(),
      })
      .eq("auth_user_id", authUserId)
      .eq("feature_id", feature)
      .eq("idempotency_key", idempotencyKey)
      .select("id")
      .single();

    if (saveRes.error) {
      console.error("result_save_failed:", saveRes.error);
      // 保存できていない = 成功判定NG（課金しない）
      await markJobFailed(
        supabase,
        authUserId,
        feature,
        idempotencyKey,
        "result_save_failed",
        "結果の保存に失敗しました。"
      );
      return NextResponse.json(
        { ok: false, error: "result_save_failed", message: "Failed to save result" },
        { status: 500 }
      );
    }

    // =========================
    // ✅ 6) 成功後のみ課金（固定仕様）
    // =========================
    if (proceedMode === "free") {
      await fetch(`${baseUrl}/api/usage/log`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookieHeader },
        body: JSON.stringify({ feature }),
      }).catch(() => {});
    } else if (proceedMode === "need_meta" && metaConfirm) {
      // Meta課金（成功後のみ）
      const { error: consumeErr } = await supabaseAdmin.rpc("consume_meta_fifo", {
        p_auth_user_id: authUserId,
        p_cost: requiredMeta,
      });

      if (consumeErr) {
        // 返す結果は成功扱い（成功判定は保存）: ログだけ残す
        console.error("consume_meta_fifo failed:", consumeErr);
      }
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
    return NextResponse.json(
      { ok: false, error: "server_error", message: "server error" },
      { status: 500 }
    );
  }
}
