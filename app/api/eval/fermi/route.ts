// app/api/eval/fermi/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL_EVAL = process.env.OPENAI_MODEL_EVAL_FERMI || "gpt-4o-mini";

// ✅ case と同じ：generation_jobs feature_id & usage/check feature を一致
const FEATURE_ID = "fermi";
const REQUIRED_META_DEFAULT = 1;

// service role（Route内だけ）
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type Database = any;

type ProceedMode = "unlimited" | "free" | "need_meta";
type JobStatus = "queued" | "running" | "blocked" | "succeeded" | "failed";

type FermiFactor = {
  id: number;
  name: string;
  operator: "×" | "+";
  assumption: string;
  rationale: string;
  value: string;
};

type FermiScore = {
  reframing: number;
  decomposition: number;
  assumptions: number;
  numbersSense: number;
  sanityCheck: number;
};

type FermiFeedback = {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  advice: string;
  sampleAnswer: string;
  totalScore: number;
};

type FermiEvalResult = {
  score: FermiScore;
  feedback: FermiFeedback;
  totalScore: number;
  logId: string | number | null; // fermi_sessions の id
};

function clamp0to10(n: any) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(10, Math.round(x)));
}

function safeJsonParseStrict(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    const m = s.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("Invalid JSON from model");
    return JSON.parse(m[0]);
  }
}

function rid() {
  return Math.random().toString(36).slice(2, 10);
}

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

// ✅ case と同じ：adminで残高を正として取る（meta_lots remaining 合計）
async function getBalanceAdmin(authUserId: string): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from("meta_lots")
    .select("remaining")
    .eq("auth_user_id", authUserId)
    .gt("remaining", 0);

  if (error) {
    console.error("getBalanceAdmin error:", error);
    return 0;
  }

  let sum = 0;
  for (const row of data ?? []) sum += Number((row as any).remaining ?? 0);
  return Number.isFinite(sum) ? sum : 0;
}

// ✅ growth_logs へ確実に入れる（RLSに詰まりやすいのでadminで）
async function insertGrowthLogSafe(params: {
  authUserId: string;
  source: string;
  title: string;
  description?: string | null;
  metadata?: any;
}) {
  const payload = {
    user_id: params.authUserId,
    source: params.source,
    title: params.title,
    description: params.description ?? null,
    metadata: params.metadata ?? null,
  };

  const r = await supabaseAdmin.from("growth_logs").insert(payload);
  if (r.error) {
    console.error("growth_logs insert failed:", r.error);
  }
}

export async function POST(req: Request) {
  const requestId = rid();

  try {
    if (!OPENAI_API_KEY) {
      return NextResponse.json(
        { ok: false, error: "server_config", message: "OPENAI_API_KEY is not set" },
        { status: 500 }
      );
    }

    const supabase = await createSupabaseFromCookies();

    // ✅ auth
    const { data: auth, error: authErr } = await supabase.auth.getUser();
    const user = auth?.user ?? null;
    if (authErr || !user?.id) {
      return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
    }
    const authUserId = user.id;

    // ✅ idempotency key（必須）
    const idempotencyKey =
      req.headers.get("x-idempotency-key") ||
      req.headers.get("X-Idempotency-Key") ||
      "";

    if (!idempotencyKey) {
      return NextResponse.json(
        { ok: false, error: "bad_request", message: "idempotency key is required" },
        { status: 400 }
      );
    }

    // ✅ meta confirm（confirm 後だけ true）
    const metaConfirm =
      req.headers.get("x-meta-confirm") === "1" ||
      req.headers.get("X-Meta-Confirm") === "1";

    // ✅ 入力
    const body = (await req.json().catch(() => ({}))) as {
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

    const question = body?.question;
    const formula = body?.formula;
    const unit = body?.unit;
    const factors = body?.factors;

    if (!question || !formula || !unit || !Array.isArray(factors)) {
      return NextResponse.json(
        { ok: false, error: "bad_request", message: "question/formula/unit/factors is required" },
        { status: 400 }
      );
    }

    // =========================
    // ✅ 0) generation_jobs lookup (idempotent)
    // =========================
    const { data: existing, error: exErr } = await supabase
      .from("generation_jobs")
      .select("id, status, result")
      .eq("auth_user_id", authUserId)
      .eq("feature_id", FEATURE_ID)
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

    if (exErr) {
      console.error(`[fermi:${requestId}] job lookup error`, exErr);
      return NextResponse.json({ ok: false, error: "db_error" }, { status: 500 });
    }

    if (existing?.status === "succeeded" && existing?.result) {
      return NextResponse.json({ ok: true, ...existing.result, reused: true });
    }

    // =========================
    // ✅ 0.5) generation_jobs upsert running
    // =========================
    const jobRequest = {
      question,
      formula,
      unit,
      factors,
      sanityComment: body.sanityComment ?? null,
      result: body.result ?? null,
      problemId: body.problemId ?? null,
      category: body.category ?? null,
      difficulty: body.difficulty ?? null,
    };

    const { data: upserted, error: upErr } = await supabase
      .from("generation_jobs")
      .upsert(
        {
          auth_user_id: authUserId,
          feature_id: FEATURE_ID,
          idempotency_key: idempotencyKey,
          status: "running" as JobStatus,
          request: jobRequest,
          error_code: null,
          error_message: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "auth_user_id,feature_id,idempotency_key" }
      )
      .select("id")
      .single();

    if (upErr || !upserted?.id) {
      console.error(`[fermi:${requestId}] job upsert error`, upErr);
      return NextResponse.json({ ok: false, error: "db_error" }, { status: 500 });
    }
    const jobId = upserted.id as string;

    // =========================
    // ✅ 1) usage/check（消費しない）
    // =========================
    const baseUrl = new URL(req.url).origin;
    const cookieHeader = req.headers.get("cookie") ?? "";

    const checkRes = await fetch(`${baseUrl}/api/usage/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieHeader },
      body: JSON.stringify({ feature: FEATURE_ID }),
    });

    const checkBody: any = await checkRes.json().catch(() => ({}));

    const requiredMetaFromCheck = Number(
      checkBody?.requiredMeta ?? checkBody?.required ?? REQUIRED_META_DEFAULT
    );

    let proceedMode: ProceedMode =
      (checkBody?.mode as ProceedMode) ?? (metaConfirm ? "need_meta" : "free");
    let requiredMeta = Number(checkBody?.requiredMeta ?? REQUIRED_META_DEFAULT);

    if (!checkRes.ok) {
      if (checkRes.status === 402 && checkBody?.error === "need_meta") {
        requiredMeta = requiredMetaFromCheck;
        proceedMode = "need_meta";

        if (!metaConfirm) {
          await supabase
            .from("generation_jobs")
            .update({
              status: "failed",
              error_code: "need_meta",
              error_message: `INSUFFICIENT_META required=${requiredMeta}`,
              updated_at: new Date().toISOString(),
            })
            .eq("id", jobId);

          return NextResponse.json(
            { ok: false, error: "need_meta", requiredMeta },
            { status: 402 }
          );
        }

        const bal = await getBalanceAdmin(authUserId);
        if (bal < requiredMeta) {
          await supabase
            .from("generation_jobs")
            .update({
              status: "failed",
              error_code: "need_meta",
              error_message: `INSUFFICIENT_META_AFTER_CONFIRM required=${requiredMeta} balance=${bal}`,
              updated_at: new Date().toISOString(),
            })
            .eq("id", jobId);

          return NextResponse.json(
            { ok: false, error: "need_meta", requiredMeta, balance: bal },
            { status: 402 }
          );
        }
      } else if (checkRes.status === 401) {
        return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
      } else {
        console.error(`[fermi:${requestId}] usage/check unexpected`, checkRes.status, checkBody);
        return NextResponse.json({ ok: false, error: "usage_error" }, { status: 500 });
      }
    } else {
      proceedMode = (checkBody?.mode as ProceedMode) ?? "free";
      requiredMeta = Number(checkBody?.requiredMeta ?? REQUIRED_META_DEFAULT);

      if (proceedMode === "need_meta" && !metaConfirm) {
        return NextResponse.json(
          { ok: false, error: "need_meta", requiredMeta },
          { status: 402 }
        );
      }

      if (proceedMode === "need_meta" && metaConfirm) {
        const bal = await getBalanceAdmin(authUserId);
        if (bal < requiredMeta) {
          return NextResponse.json(
            { ok: false, error: "need_meta", requiredMeta, balance: bal },
            { status: 402 }
          );
        }
      }
    }

    // =========================
    // ✅ 2) OpenAI（必ずJSON）
    // =========================
    const system = `
あなたはフェルミ推定の面接官。日本語で辛口だが建設的。
出力は必ず JSON 形式のみ。前後に説明文は書かない。
スコアは0〜10の整数（5軸）。totalScoreは5軸の合計（0〜50）。
strengths/weaknessesは配列（3〜6個）。
sampleAnswerは「短い模範（手順＋代表値＋結論）」。
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
${body.sanityComment || "(なし)"}

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
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL_EVAL,
        response_format: { type: "json_object" },
        temperature: 0.2,
        messages: [
          { role: "system", content: system },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!r.ok) {
      const errText = await r.text().catch(() => "");
      console.error(`[fermi:${requestId}] openai error`, errText);

      await supabase
        .from("generation_jobs")
        .update({
          status: "failed",
          error_code: "openai_error",
          error_message: errText.slice(0, 4000),
          updated_at: new Date().toISOString(),
        })
        .eq("id", jobId);

      return NextResponse.json({ ok: false, error: "openai_error" }, { status: 500 });
    }

    const j = await r.json();
    const content: string | null = j.choices?.[0]?.message?.content ?? null;

    if (!content) {
      await supabase
        .from("generation_jobs")
        .update({
          status: "failed",
          error_code: "empty_content",
          error_message: "OpenAI returned empty content",
          updated_at: new Date().toISOString(),
        })
        .eq("id", jobId);

      return NextResponse.json({ ok: false, error: "empty_content" }, { status: 500 });
    }

    let parsed: any;
    try {
      parsed = safeJsonParseStrict(content);
    } catch (e) {
      await supabase
        .from("generation_jobs")
        .update({
          status: "failed",
          error_code: "json_parse_error",
          error_message: String(e).slice(0, 1000),
          updated_at: new Date().toISOString(),
        })
        .eq("id", jobId);

      return NextResponse.json({ ok: false, error: "json_parse_error" }, { status: 500 });
    }

    const sc = parsed?.score ?? {};
    const fb = parsed?.feedback ?? {};

    const score: FermiScore = {
      reframing: clamp0to10(sc.reframing),
      decomposition: clamp0to10(sc.decomposition),
      assumptions: clamp0to10(sc.assumptions),
      numbersSense: clamp0to10(sc.numbersSense),
      sanityCheck: clamp0to10(sc.sanityCheck),
    };

    const totalScore =
      score.reframing +
      score.decomposition +
      score.assumptions +
      score.numbersSense +
      score.sanityCheck;

    const feedback: FermiFeedback = {
      summary: String(fb.summary ?? ""),
      strengths: Array.isArray(fb.strengths) ? fb.strengths.map(String) : [],
      weaknesses: Array.isArray(fb.weaknesses) ? fb.weaknesses.map(String) : [],
      advice: String(fb.advice ?? ""),
      sampleAnswer: String(fb.sampleAnswer ?? ""),
      totalScore,
    };

    // =========================
    // ✅ 3) fermi_sessions insert（確実に通す）
    // =========================
    let logId: string | number | null = null;

    try {
      // ✅ 注意：fermi_sessions に job_id / idempotency_key の列が無いなら入れない
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
          sanityComment: body.sanityComment ?? null,
          result: body.result ?? null,
          feedback,
          // ✅ 追跡したいなら payload 内に入れる（列増やさずOK）
          jobId,
          idempotencyKey,
        },
      };

      let ins = await supabase.from("fermi_sessions").insert(insertPayload).select("id").single();
      if (ins.error) {
        ins = await supabaseAdmin.from("fermi_sessions").insert(insertPayload).select("id").single();
        if (ins.error) console.error(`[fermi:${requestId}] fermi_sessions insert error`, ins.error);
      }
      if (ins.data?.id) logId = ins.data.id;
    } catch (e) {
      console.error(`[fermi:${requestId}] fermi_sessions insert failed`, e);
    }

    // =========================
    // ✅ 4) generation_jobs result保存
    // =========================
    const result: FermiEvalResult = {
      score,
      feedback,
      totalScore,
      logId,
    };

    const { error: saveErr } = await supabase
      .from("generation_jobs")
      .update({
        status: "succeeded",
        result,
        updated_at: new Date().toISOString(),
        log_id: logId ? String(logId) : null,
      })
      .eq("id", jobId);

    if (saveErr) {
      console.error(`[fermi:${requestId}] result save failed`, saveErr);
      return NextResponse.json({ ok: false, error: "result_save_failed" }, { status: 500 });
    }

    // =========================
    // ✅ 4.5) growth_logs（成功後に必ず）
    // =========================
    await insertGrowthLogSafe({
  authUserId,
  source: "fermi",
  title: "フェルミ推定：評価完了",
  description: `お題：${String(question).slice(0, 48)}\nスコア：${totalScore}/50`,
  metadata: {
    jobId,
    idempotencyKey,
    logId,
    problem_id: body.problemId ?? null,
    category: body.category ?? null,
    difficulty: body.difficulty ?? null,
    totalScore,
    proceedMode,
  },
});


    // =========================
    // ✅ 5) 成功後だけ課金
    // =========================
    if (proceedMode === "free") {
      await fetch(`${baseUrl}/api/usage/log`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookieHeader },
        body: JSON.stringify({ feature: FEATURE_ID, jobId, idempotencyKey, logId }),
      }).catch(() => {});
    } else if (proceedMode === "need_meta" && metaConfirm) {
      const { error: consumeErr } = await supabaseAdmin.rpc("consume_meta_fifo", {
        p_auth_user_id: authUserId,
        p_cost: requiredMeta,
      });

      if (consumeErr) {
        await supabase
          .from("generation_jobs")
          .update({
            log_id: `meta_charge_failed:${String(consumeErr.message ?? "").slice(0, 200)}`,
            updated_at: new Date().toISOString(),
          })
          .eq("id", jobId);
      }
    }

    return NextResponse.json({
      ok: true,
      ...result,
      jobId,
      idempotencyKey,
    });
  } catch (e: any) {
    console.error("Fermi Eval API error:", e);
    return NextResponse.json(
      { ok: false, error: "server_error", message: "フェルミ評価に失敗しました" },
      { status: 500 }
    );
  }
}
