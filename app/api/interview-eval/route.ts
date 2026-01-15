// app/api/interview-eval/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import personasConfig from "@/config/personas.json";
import scoringConfig from "@/config/scoring_config.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = "gpt-4o-mini";

// ✅ generation_jobs の feature_id と一致
const FEATURE_ID = "interview_10";
const REQUIRED_META = 2;

// ------------------------------
// Supabase
// ------------------------------
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

// ✅ 課金系は service role（Route内だけ）
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ------------------------------
// Types
// ------------------------------
type QA = { question: string; answer: string };
type Persona = (typeof personasConfig)["personas"][number];

type EvaluationResult = {
  total_score: number;
  star_score: number;
  content_depth_score: number;
  clarity_score: number;
  delivery_score: number;
  auto_feedback: {
    good_points: string[];
    improvement_points: string[];
    one_sentence_advice: string;
  };
};

type ProceedMode = "unlimited" | "free" | "need_meta";

// ------------------------------
// Defaults & validators
// ------------------------------
const DEFAULT_RESULT: EvaluationResult = {
  total_score: 60,
  star_score: 60,
  content_depth_score: 60,
  clarity_score: 60,
  delivery_score: 60,
  auto_feedback: {
    good_points: ["全体として分かりやすく整理して話せています。"],
    improvement_points: ["具体例や数字をもう一歩踏み込んで伝えると、説得力がさらに増します。"],
    one_sentence_advice: "一番伝えたいメッセージを最初に置き、そこに向けてSTARで話しましょう。",
  },
};

function nowIso() {
  return new Date().toISOString();
}

function safeStr(v: unknown, maxLen: number) {
  if (typeof v !== "string") return "";
  return v.slice(0, maxLen);
}

function findPersona(personaId?: string): Persona {
  const list = personasConfig.personas as Persona[];
  return (personaId && list.find((p) => p.id === personaId)) || list[0];
}

function toSafeEval(parsed: any): EvaluationResult {
  const safe: EvaluationResult = {
    ...DEFAULT_RESULT,
    ...(parsed ?? {}),
    auto_feedback: {
      ...DEFAULT_RESULT.auto_feedback,
      ...((parsed?.auto_feedback ?? {}) as any),
    },
  };

  const clamp = (n: any) => {
    const x = Number(n);
    if (!Number.isFinite(x)) return 60;
    return Math.max(0, Math.min(100, Math.round(x)));
  };

  return {
    ...safe,
    total_score: clamp(safe.total_score),
    star_score: clamp(safe.star_score),
    content_depth_score: clamp(safe.content_depth_score),
    clarity_score: clamp(safe.clarity_score),
    delivery_score: clamp(safe.delivery_score),
    auto_feedback: {
      good_points: Array.isArray(safe.auto_feedback.good_points)
        ? safe.auto_feedback.good_points
        : DEFAULT_RESULT.auto_feedback.good_points,
      improvement_points: Array.isArray(safe.auto_feedback.improvement_points)
        ? safe.auto_feedback.improvement_points
        : DEFAULT_RESULT.auto_feedback.improvement_points,
      one_sentence_advice:
        typeof safe.auto_feedback.one_sentence_advice === "string"
          ? safe.auto_feedback.one_sentence_advice
          : DEFAULT_RESULT.auto_feedback.one_sentence_advice,
    },
  };
}

// ------------------------------
// helpers: 402 response unified（stage無し）
// ------------------------------
function needMetaResponse(args: { requiredMeta: number; balance?: number | null }) {
  const { requiredMeta, balance } = args;
  return NextResponse.json(
    {
      ok: false,
      error: "need_meta",
      requiredMeta,
      ...(balance != null ? { balance } : {}),
    },
    { status: 402 }
  );
}

async function markJobBlocked(args: {
  supabase: any;
  jobId: string;
  reason: string;
}) {
  const { supabase, jobId, reason } = args;
  try {
    await supabase
      .from("generation_jobs")
      .update({
        status: "blocked",
        error_code: "need_meta",
        error_message: reason,
        updated_at: nowIso(),
      })
      .eq("id", jobId);
  } catch (e) {
    console.error("markJobBlocked crashed:", e);
  }
}

async function markJobFailed(args: {
  supabase: any;
  jobId: string;
  error_code: string;
  error_message: string;
}) {
  const { supabase, jobId, error_code, error_message } = args;
  try {
    await supabase
      .from("generation_jobs")
      .update({
        status: "failed",
        result: null,
        error_code,
        error_message,
        updated_at: nowIso(),
      })
      .eq("id", jobId);
  } catch (e) {
    console.error("markJobFailed crashed:", e);
  }
}

async function callUsageLog(req: NextRequest, jobId: string) {
  const base = req.nextUrl.origin;
  try {
    await fetch(`${base}/api/usage/log`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: req.headers.get("cookie") ?? "",
      },
      body: JSON.stringify({
        feature: FEATURE_ID,
        jobId,
      }),
    });
  } catch (e) {
    console.error("usage/log call failed:", e);
  }
}

// ------------------------------
// Route（industry-insights と同フロー）
// ------------------------------
export async function POST(req: NextRequest) {
  // 0) server config
  if (!OPENAI_API_KEY) {
    return NextResponse.json(
      { ok: false, error: "server_config", message: "OPENAI_API_KEY is not set" },
      { status: 500 }
    );
  }

  const supabase = await createSupabaseFromCookies();

  // auth（RLS前提）
  const { data: auth, error: authErr } = await supabase.auth.getUser();
  const user = auth?.user ?? null;
  if (authErr || !user?.id) {
    return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
  }
  const authUserId = user.id;

  // idempotency key（必須）
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

  // meta confirm（モーダル confirm 後だけ true）
  const metaConfirm =
    req.headers.get("x-meta-confirm") === "1" ||
    req.headers.get("X-Meta-Confirm") === "1";

  // body
  const body = (await req.json().catch(() => ({}))) as {
    qaList?: QA[];
    persona_id?: string;
    topic?: string;
    is_sensitive?: boolean;
  };

  const qaList: QA[] = Array.isArray(body.qaList) ? body.qaList : [];
  const personaId = typeof body.persona_id === "string" ? body.persona_id : undefined;
  const topic = safeStr(body.topic, 120) || "一般面接";
  const isSensitive = Boolean(body.is_sensitive);

  if (!qaList.length) {
    return NextResponse.json(
      { ok: false, error: "bad_request", message: "qaList is required" },
      { status: 400 }
    );
  }

  // =========================
  // ✅ 0) generation_jobs upsert（industry方式）
  // =========================
  // 既に succeeded なら即返す（再実行しない）
  const { data: existing, error: exErr } = await supabase
    .from("generation_jobs")
    .select("id, status, result")
    .eq("auth_user_id", authUserId)
    .eq("feature_id", FEATURE_ID)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (exErr) {
    console.error("[interview] job lookup error", exErr);
    return NextResponse.json({ ok: false, error: "db_error" }, { status: 500 });
  }

  if (existing?.status === "succeeded" && existing?.result) {
    return NextResponse.json({
      ok: true,
      ...(existing.result as any),
      jobId: existing.id,
      idempotencyKey,
      reused: true,
    });
  }

  const jobRequest = {
    persona_id: personaId ?? null,
    topic,
    is_sensitive: isSensitive,
    qaList,
  };

  // なければ作成、あれば running に更新
  const { data: upserted, error: upErr } = await supabase
    .from("generation_jobs")
    .upsert(
      {
        auth_user_id: authUserId,
        feature_id: FEATURE_ID,
        idempotency_key: idempotencyKey,
        status: "running",
        request: jobRequest,
        error_code: null,
        error_message: null,
        updated_at: nowIso(),
      },
      { onConflict: "auth_user_id,feature_id,idempotency_key" }
    )
    .select("id, status")
    .single();

  if (upErr || !upserted?.id) {
    console.error("[interview] job upsert error", upErr);
    return NextResponse.json({ ok: false, error: "db_error" }, { status: 500 });
  }
  const jobId = upserted.id as string;

  // =========================
  // ✅ 1) usage/check（消費しない）… industry方式
  // =========================
  const baseUrl = req.nextUrl.origin;
  const cookieHeader = req.headers.get("cookie") ?? "";

  const checkRes = await fetch(`${baseUrl}/api/usage/check`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookieHeader },
    body: JSON.stringify({ feature: FEATURE_ID, requiredMeta: REQUIRED_META }),
  });

  const checkBody: any = await checkRes.json().catch(() => ({}));

  if (!checkRes.ok) {
    if (checkRes.status === 402 && checkBody?.error === "need_meta") {
      const requiredMeta = Number(checkBody?.requiredMeta ?? REQUIRED_META);

      // ✅ confirm 前は 402 を返して止める（課金はしない）
      if (!metaConfirm) {
        await markJobBlocked({
          supabase,
          jobId,
          reason: "need_meta_before_confirm",
        });
        return needMetaResponse({ requiredMeta });
      }
      // ✅ confirm 後は続行（ただし後段で残高チェックを挟む）
    } else if (checkRes.status === 401) {
      return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
    } else {
      console.error("[interview] usage/check unexpected", checkRes.status, checkBody);
      await markJobFailed({
        supabase,
        jobId,
        error_code: "usage_error",
        error_message: `usage/check failed: ${String(checkRes.status)}`,
      });
      return NextResponse.json({ ok: false, error: "usage_error" }, { status: 500 });
    }
  }

  const proceedMode: ProceedMode =
    (checkBody?.mode as ProceedMode) ?? (metaConfirm ? "need_meta" : "free");

  const requiredMeta = Number(checkBody?.requiredMeta ?? REQUIRED_META);

  // =========================
  // ✅ 1.5) confirm後の最終防衛：残高が足りないなら OpenAI を叩かない（industry方式）
  //     残高参照を get_my_meta_balance に統一（meta_lots 集計が真実）
  // =========================
  if (proceedMode === "need_meta" && metaConfirm) {
    const { data: mbData, error: mbErr } = await supabase.rpc("get_my_meta_balance");

    let bal = 0;
    if (!mbErr) {
      if (typeof mbData === "number") {
        bal = mbData;
      } else if (mbData && typeof mbData === "object") {
        const anyData = mbData as any;
        const v =
          anyData.balance ??
          anyData.meta_balance ??
          anyData.metaBalance ??
          anyData.value ??
          0;
        bal = Number(v);
      } else {
        bal = Number(mbData ?? 0);
      }
    }

    if (mbErr || !Number.isFinite(bal) || bal < requiredMeta) {
      await markJobBlocked({
        supabase,
        jobId,
        reason: mbErr ? "meta_balance_rpc_error" : "insufficient_meta_after_confirm",
      });

      return needMetaResponse({
        requiredMeta,
        balance: Number.isFinite(bal) ? bal : null,
      });
    }
  }

  // =========================
  // ✅ 2) OpenAI
  // =========================
  const persona = findPersona(personaId);

  const interviewLog = qaList
    .map(
      (qa, idx) =>
        `Q${idx + 1}: ${safeStr(qa.question, 2000)}\nA${idx + 1}: ${
          safeStr(qa.answer, 4000) || "（無回答）"
        }`
    )
    .join("\n\n");

  const criteriaDescription = (scoringConfig as any).criteria
    .map((c: any) => `- ${c.id} (${c.label}): weight=${c.weight} / ${c.description}`)
    .join("\n");

  const systemPrompt = [
    persona.system_prompt,
    "",
    "あなたは上記の人格で、候補者の模擬面接全体を評価する役割です。",
    "出力は必ず JSON 形式「のみ」で返してください（日本語）。",
    "前後に説明文は書かないでください。",
    "",
    "スコアリング仕様:",
    criteriaDescription,
    "",
    "total_score は 0〜100 の範囲で、各スコアと整合的な値にしてください。",
  ].join("\n");

  const userPrompt = `
以下は候補者との模擬面接（一般質問×最大10問）のログです。

${interviewLog}

このログをもとに、以下の形式の JSON を日本語で返してください。

{
  "total_score": number,
  "star_score": number,
  "content_depth_score": number,
  "clarity_score": number,
  "delivery_score": number,
  "auto_feedback": {
    "good_points": string[],
    "improvement_points": string[],
    "one_sentence_advice": string
  }
}

注意:
- 候補者にとってわかりやすい言葉で書いてください。
- 厳しめの評価でも構いませんが、必ず前向きなトーンを維持してください。
`.trim();

  let safeEval: EvaluationResult = DEFAULT_RESULT;

  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.35,
      }),
    });

    if (!r.ok) {
      const errText = await r.text().catch(() => "");
      console.error("[interview] openai error", errText);

      await markJobFailed({
        supabase,
        jobId,
        error_code: "openai_error",
        error_message: errText.slice(0, 4000),
      });

      return NextResponse.json({ ok: false, error: "openai_error" }, { status: 500 });
    }

    const j = await r.json().catch(() => null);
    const content: string | null = j?.choices?.[0]?.message?.content ?? null;

    if (!content) {
      await markJobFailed({
        supabase,
        jobId,
        error_code: "empty_content",
        error_message: "OpenAI returned empty content",
      });
      return NextResponse.json({ ok: false, error: "empty_content" }, { status: 500 });
    }

    try {
      const parsed = JSON.parse(content);
      safeEval = toSafeEval(parsed);
    } catch (e) {
      await markJobFailed({
        supabase,
        jobId,
        error_code: "json_parse_error",
        error_message: String(e).slice(0, 1000),
      });
      return NextResponse.json({ ok: false, error: "json_parse_error" }, { status: 500 });
    }
  } catch (e: any) {
    await markJobFailed({
      supabase,
      jobId,
      error_code: "openai_error",
      error_message: e?.message || "OpenAI call failed",
    });
    return NextResponse.json({ ok: false, error: "openai_error" }, { status: 500 });
  }

  // =========================
  // ✅ 3) 成功判定 = generation_jobs に result 保存できた
  // =========================
  const saveAt = nowIso();

  const { error: saveErr } = await supabase
    .from("generation_jobs")
    .update({
      status: "succeeded",
      result: safeEval,
      error_code: null,
      error_message: null,
      updated_at: saveAt,
    })
    .eq("id", jobId);

  if (saveErr) {
    console.error("[interview] result save failed", saveErr);
    // ここで課金しない（事故回避）
    return NextResponse.json({ ok: false, error: "result_save_failed" }, { status: 500 });
  }

  // =========================
  // ✅ 4) 成功後だけ課金（free: usage/log / meta: consume_meta_fifo）… industry方式
  // =========================
  if (proceedMode === "free") {
    await callUsageLog(req, jobId);
  } else if (proceedMode === "need_meta" && metaConfirm) {
    const { error: consumeErr } = await supabaseAdmin.rpc("consume_meta_fifo", {
      p_auth_user_id: authUserId,
      p_cost: requiredMeta,
    });

    // ✅ 失敗したら結果を渡さず 402 で戻す（industryの肝）
    if (consumeErr) {
      await supabase
        .from("generation_jobs")
        .update({
          error_code: "need_meta",
          error_message: `meta_charge_failed:${String(consumeErr.message ?? "").slice(0, 200)}`,
          updated_at: nowIso(),
        })
        .eq("id", jobId);

      return needMetaResponse({ requiredMeta });
    }
  }

  // =========================
  // ✅ 5) ログ（best-effort）… 既存維持
  // =========================
  try {
    await supabase.from("usage_logs").insert({
      user_id: authUserId,
      feature: FEATURE_ID,
      used_at: saveAt,
    });

    await supabase.from("growth_logs").insert({
      user_id: authUserId,
      source: FEATURE_ID,
      title: `面接評価：${topic}`,
      description: "模擬面接の回答を評価し、フィードバックを生成しました。",
      metadata: {
        feature: FEATURE_ID,
        jobId,
        idempotencyKey,
        persona_id: personaId ?? null,
        topic,
        proceedMode,
        scores: {
          total: safeEval.total_score,
          star: safeEval.star_score,
          content_depth: safeEval.content_depth_score,
          clarity: safeEval.clarity_score,
          delivery: safeEval.delivery_score,
        },
      },
      created_at: saveAt,
    });

    const { data: session, error: sessionErr } = await supabase
      .from("interview_sessions")
      .insert({
        user_id: authUserId,
        topic,
        is_sensitive: isSensitive,
        created_at: saveAt,
      })
      .select("id")
      .single();

    if (!sessionErr && session?.id) {
      const sessionId = session.id;

      const turns = qaList
        .flatMap((qa) => {
          const q = safeStr(qa.question, 2000);
          const a = safeStr(qa.answer, 4000);
          return [
            { role: "question", message: q },
            { role: "answer", message: a || "（無回答）" },
          ];
        })
        .map((t) => ({
          session_id: sessionId,
          user_id: authUserId,
          role: t.role,
          message: t.message,
          is_sensitive: isSensitive,
          created_at: saveAt,
        }));

      await supabase.from("interview_turns").insert(turns);
      await supabase.from("interview_logs").insert({
        user_id: authUserId,
        qas: qaList,
        score: Math.round(safeEval.total_score),
        created_at: saveAt,
      });
    } else if (sessionErr) {
      console.error("[interview] interview_sessions insert error:", sessionErr);
    }
  } catch (e) {
    console.error("[interview] post-success logs insert crash:", e);
  }

  return NextResponse.json({
    ok: true,
    ...safeEval,
    jobId,
    idempotencyKey,
  });
}
