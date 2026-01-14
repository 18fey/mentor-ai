// app/api/interview-eval/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import personasConfig from "@/config/personas.json";
import scoringConfig from "@/config/scoring_config.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

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

function findPersona(personaId?: string): Persona {
  const list = personasConfig.personas as Persona[];
  return (personaId && list.find((p) => p.id === personaId)) || list[0];
}

function safeStr(v: unknown, maxLen: number) {
  if (typeof v !== "string") return "";
  return v.slice(0, maxLen);
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

async function callUsageCheck(req: NextRequest): Promise<
  | { ok: true; mode: ProceedMode; requiredMeta: number }
  | { ok: false; status: number; requiredMeta: number }
> {
  const base = req.nextUrl.origin;

  try {
    const res = await fetch(`${base}/api/usage/check`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: req.headers.get("cookie") ?? "",
      },
      body: JSON.stringify({
        feature: FEATURE_ID,
        requiredMeta: REQUIRED_META,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (res.status === 402 || data?.error === "need_meta") {
      const requiredMeta =
        Number(data?.requiredMeta ?? data?.required ?? REQUIRED_META) || REQUIRED_META;
      return { ok: false, status: 402, requiredMeta };
    }

    if (!res.ok) {
      const requiredMeta = Number(data?.requiredMeta ?? REQUIRED_META) || REQUIRED_META;
      return { ok: false, status: res.status || 500, requiredMeta };
    }

    const mode = (data?.mode as ProceedMode) || "free";
    const requiredMeta = Number(data?.requiredMeta ?? REQUIRED_META) || REQUIRED_META;
    return { ok: true, mode, requiredMeta };
  } catch (e) {
    console.error("usage/check call failed:", e);
    return { ok: false, status: 500, requiredMeta: REQUIRED_META };
  }
}

async function callUsageLog(req: NextRequest, idempotencyKey: string) {
  const base = req.nextUrl.origin;
  try {
    await fetch(`${base}/api/usage/log`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: req.headers.get("cookie") ?? "",
        "X-Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        feature: FEATURE_ID,
        idempotencyKey,
      }),
    });
  } catch (e) {
    console.error("usage/log call failed:", e);
  }
}

function nowIso() {
  return new Date().toISOString();
}

// ------------------------------
// Route
// ------------------------------
export async function POST(req: NextRequest) {
  const supabase = await createSupabaseFromCookies();

  // auth
  const { data: auth, error: authErr } = await supabase.auth.getUser();
  const user = auth?.user ?? null;
  if (authErr || !user?.id) {
    return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
  }
  const authUserId = user.id;

  // idempotency key（header優先）
  const headerKey = req.headers.get("x-idempotency-key") || "";
  const headerMetaConfirm = req.headers.get("x-meta-confirm") || "";
  const metaConfirm = headerMetaConfirm === "1";

  const body = (await req.json().catch(() => ({}))) as {
    idempotencyKey?: string;
    qaList?: QA[];
    persona_id?: string;
    topic?: string;
    is_sensitive?: boolean;
  };

  const idempotencyKey = safeStr(headerKey || body.idempotencyKey, 160);
  if (!idempotencyKey) {
    return NextResponse.json(
      { ok: false, error: "bad_request", message: "idempotencyKey is required" },
      { status: 400 }
    );
  }

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

  // 1) 既存ジョブ確認（reused / running）
  try {
    const { data: existing, error: selErr } = await supabase
      .from("generation_jobs")
      .select("id,status,result,request,error_code,error_message")
      .eq("auth_user_id", authUserId)
      .eq("feature_id", FEATURE_ID)
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

    if (selErr) {
      console.error("generation_jobs select error:", selErr);
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

    if (existing && (existing.status === "running" || existing.status === "queued")) {
      return NextResponse.json({
        ok: true,
        jobId: existing.id,
        idempotencyKey,
        status: existing.status,
        reused: true,
      });
    }
  } catch (e) {
    console.error("generation_jobs precheck crash:", e);
    return NextResponse.json({ ok: false, error: "db_error" }, { status: 500 });
  }

  // 2) proceedMode は /api/usage/check の mode が真実
  const check = await callUsageCheck(req);

  // 残高不足：purchase導線へ
  if (!check.ok && check.status === 402) {
    return NextResponse.json(
      { ok: false, error: "need_meta", requiredMeta: check.requiredMeta },
      { status: 402 }
    );
  }

  // usage/check が死んでたら止める（真実が取れない）
  if (!check.ok) {
    return NextResponse.json(
      { ok: false, error: "server_error", message: "usage_check_failed" },
      { status: 500 }
    );
  }

  const proceedMode = check.mode;
  const requiredMeta = check.requiredMeta;

  // ✅ need_meta（=メタ消費機能）では confirm 二段階
  if (proceedMode === "need_meta" && !metaConfirm) {
    return NextResponse.json(
      { ok: false, error: "need_meta", requiredMeta },
      { status: 402 }
    );
  }

  // 3) generation_jobs upsert(running)
  const requestPayload = {
    persona_id: personaId ?? null,
    topic,
    is_sensitive: isSensitive,
    qaList,
  };

  const { data: jobRow, error: upsertErr } = await supabase
    .from("generation_jobs")
    .upsert(
      {
        auth_user_id: authUserId,
        feature_id: FEATURE_ID,
        idempotency_key: idempotencyKey,
        status: "running",
        request: requestPayload,
        result: null,
        error_code: null,
        error_message: null,
        log_id: null,
        updated_at: nowIso(),
      },
      { onConflict: "auth_user_id,feature_id,idempotency_key" }
    )
    .select("id,status")
    .single();

  if (upsertErr || !jobRow?.id) {
    console.error("generation_jobs upsert error:", upsertErr);
    return NextResponse.json({ ok: false, error: "db_error" }, { status: 500 });
  }
  const jobId = jobRow.id as string;

  // 4) OpenAI
  if (!OPENAI_API_KEY) {
    await supabase
      .from("generation_jobs")
      .update({
        status: "failed",
        error_code: "server_config",
        error_message: "OPENAI_API_KEY is not set",
        updated_at: nowIso(),
      })
      .eq("auth_user_id", authUserId)
      .eq("feature_id", FEATURE_ID)
      .eq("idempotency_key", idempotencyKey);

    return NextResponse.json(
      { ok: false, error: "server_config", message: "OPENAI_API_KEY is not set" },
      { status: 500 }
    );
  }

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
    "出力は必ず JSON 形式のみで返してください（日本語）。",
    "JSON 以外のテキストは一切書かないでください。",
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
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("interview-eval OpenAI error:", errText);

      await supabase
        .from("generation_jobs")
        .update({
          status: "failed",
          error_code: "openai_error",
          error_message: `OpenAI error: ${res.status}`,
          updated_at: nowIso(),
        })
        .eq("auth_user_id", authUserId)
        .eq("feature_id", FEATURE_ID)
        .eq("idempotency_key", idempotencyKey);

      return NextResponse.json({ ok: false, error: "openai_error" }, { status: 500 });
    }

    const data = await res.json().catch(() => null);
    const content = data?.choices?.[0]?.message?.content;

    if (!content || typeof content !== "string") {
      console.error("interview-eval invalid OpenAI response:", data);

      await supabase
        .from("generation_jobs")
        .update({
          status: "failed",
          error_code: "openai_error",
          error_message: "invalid OpenAI response",
          updated_at: nowIso(),
        })
        .eq("auth_user_id", authUserId)
        .eq("feature_id", FEATURE_ID)
        .eq("idempotency_key", idempotencyKey);

      return NextResponse.json({ ok: false, error: "openai_error" }, { status: 500 });
    }

    try {
      const parsed = JSON.parse(content);
      safeEval = toSafeEval(parsed);
    } catch (e) {
      console.error("JSON parse error (interview-eval):", e, content);

      await supabase
        .from("generation_jobs")
        .update({
          status: "failed",
          error_code: "json_parse_error",
          error_message: "failed to parse model JSON",
          updated_at: nowIso(),
        })
        .eq("auth_user_id", authUserId)
        .eq("feature_id", FEATURE_ID)
        .eq("idempotency_key", idempotencyKey);

      return NextResponse.json({ ok: false, error: "json_parse_error" }, { status: 500 });
    }
  } catch (e: any) {
    console.error("OpenAI call crash (interview-eval):", e);

    await supabase
      .from("generation_jobs")
      .update({
        status: "failed",
        error_code: "openai_error",
        error_message: e?.message || "OpenAI call failed",
        updated_at: nowIso(),
      })
      .eq("auth_user_id", authUserId)
      .eq("feature_id", FEATURE_ID)
      .eq("idempotency_key", idempotencyKey);

    return NextResponse.json({ ok: false, error: "openai_error" }, { status: 500 });
  }

  // 5) generation_jobs に result 保存(succeeded)
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
    .eq("auth_user_id", authUserId)
    .eq("feature_id", FEATURE_ID)
    .eq("idempotency_key", idempotencyKey);

  if (saveErr) {
    console.error("generation_jobs result_save_failed:", saveErr);

    await supabase
      .from("generation_jobs")
      .update({
        status: "failed",
        error_code: "result_save_failed",
        error_message: "failed to save result to generation_jobs",
        updated_at: nowIso(),
      })
      .eq("auth_user_id", authUserId)
      .eq("feature_id", FEATURE_ID)
      .eq("idempotency_key", idempotencyKey);

    return NextResponse.json({ ok: false, error: "result_save_failed" }, { status: 500 });
  }

  // 6) 成功後のみ課金（proceedMode）
  // ✅ 方針統一：課金に失敗したら「結果を返さない」（= API失敗）
  // ✅ DB上の consume_meta_fifo は (p_auth_user_id uuid, p_cost integer) -> jsonb
  try {
    if (proceedMode === "unlimited") {
      // no-op
    } else if (proceedMode === "free") {
      // free は “計測” が落ちても致命ではない（※ここは best-effort 維持）
      await callUsageLog(req, idempotencyKey);
    } else if (proceedMode === "need_meta") {
      const { data: rpcData, error: rpcErr } = await supabase.rpc("consume_meta_fifo", {
        p_auth_user_id: authUserId,
        p_cost: requiredMeta,
      });

      if (rpcErr) {
        console.error("consume_meta_fifo error:", rpcErr);

        // ✅ 重要：課金失敗なら結果を返さない。ジョブも失敗に戻す（再試行前提）
        await supabase
          .from("generation_jobs")
          .update({
            status: "failed",
            result: null,
            error_code: "billing_failed",
            error_message: "META消費に失敗しました。通信環境を確認して再度お試しください。",
            updated_at: nowIso(),
          })
          .eq("auth_user_id", authUserId)
          .eq("feature_id", FEATURE_ID)
          .eq("idempotency_key", idempotencyKey);

        return NextResponse.json(
          {
            ok: false,
            error: "billing_failed",
            message: "META消費に失敗しました。時間をおいて再度お試しください。",
          },
          { status: 500 }
        );
      }

      // 念のため：関数が jsonb で失敗情報を返す設計だった場合にも備える（安全側）
      // 例: { ok:false, error:"insufficient" } など
      const maybeOk = (rpcData as any)?.ok;
      if (maybeOk === false) {
        console.error("consume_meta_fifo returned non-ok:", rpcData);

        await supabase
          .from("generation_jobs")
          .update({
            status: "failed",
            result: null,
            error_code: "billing_failed",
            error_message: "META消費に失敗しました。もう一度お試しください。",
            updated_at: nowIso(),
          })
          .eq("auth_user_id", authUserId)
          .eq("feature_id", FEATURE_ID)
          .eq("idempotency_key", idempotencyKey);

        return NextResponse.json(
          { ok: false, error: "billing_failed", message: "META消費に失敗しました。もう一度お試しください。" },
          { status: 500 }
        );
      }
    }
  } catch (e) {
    console.error("post-success billing step crashed:", e);

    if (proceedMode === "need_meta") {
      await supabase
        .from("generation_jobs")
        .update({
          status: "failed",
          result: null,
          error_code: "billing_failed",
          error_message: "META消費に失敗しました。通信環境を確認して再度お試しください。",
          updated_at: nowIso(),
        })
        .eq("auth_user_id", authUserId)
        .eq("feature_id", FEATURE_ID)
        .eq("idempotency_key", idempotencyKey);

      return NextResponse.json(
        { ok: false, error: "billing_failed", message: "META消費に失敗しました。時間をおいて再度お試しください。" },
        { status: 500 }
      );
    }

    // free/unlimited はログ周りの例外は握って良い
  }

  // 7) 既存ログ（成功時のみ）
  // ✅ need_meta は課金成功後にのみログを積む（整合性のため）
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
        persona_id: personaId ?? null,
        topic,
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
      console.error("interview_sessions insert error:", sessionErr);
    }
  } catch (e) {
    console.error("post-success logs insert crash:", e);
    // ログ失敗は致命にしない（課金は終わっている/結果は返す）
  }

  return NextResponse.json({
    ok: true,
    ...safeEval,
    jobId,
    idempotencyKey,
  });
}
