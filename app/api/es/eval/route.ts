// app/api/es/eval/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL_ES = process.env.OPENAI_MODEL_EVAL_ES || "gpt-4.1-mini";

// ✅ usage側（/api/usage/check / /api/usage/log に合わせる）
const USAGE_FEATURE_KEY = "es_correction";
// ✅ meta消費（FEATURE_META_COSTのキー）
const GATE_FEATURE_ID = "es_correction";

// ✅ generation_jobs の feature_id（status復帰で使う）
const FEATURE_ID = "es_eval";

// service role（Route内だけ）
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

/* ------------------------------
   Types
--------------------------------*/
const ALLOWED_QTYPES = ["self_pr", "gakuchika", "why_company", "why_industry", "other"] as const;
type QuestionType = (typeof ALLOWED_QTYPES)[number];

type EvalRequestBody = {
  text?: string;
  company?: string;
  qType?: string;
  limit?: number;
  userId?: string; // 互換：送られてきても無視
};

type EsScore = {
  structure: number;
  logic: number;
  clarity: number;
  companyFit: number;
  lengthFit: number;
};

type EsFeedback = {
  summary: string;
  strengths: string[];
  improvements: string[];
  checklist: string[];
  sampleStructure: string;
};

type EvalResult = {
  score: EsScore;
  feedback: EsFeedback;
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

function rid() {
  return Math.random().toString(36).slice(2, 10);
}

export async function POST(req: Request) {
  const requestId = rid();

  try {
    if (!OPENAI_API_KEY) {
      return NextResponse.json(
        { ok: false, error: "server_config", message: "Missing OPENAI_API_KEY" },
        { status: 500 }
      );
    }

    // ✅ cookieセッションから本人確定
    const supabase = await createSupabaseFromCookies();
    const { data: auth, error: authErr } = await supabase.auth.getUser();
    const user = auth?.user ?? null;

    if (authErr || !user?.id) {
      return NextResponse.json(
        { ok: false, error: "unauthorized", message: "login required" },
        { status: 401 }
      );
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

    // ✅ meta confirm（モーダル confirm 後だけ true）
    const metaConfirm =
      req.headers.get("x-meta-confirm") === "1" ||
      req.headers.get("X-Meta-Confirm") === "1";

    const body = (await req.json().catch(() => null)) as EvalRequestBody | null;
    if (!body) {
      return NextResponse.json(
        { ok: false, error: "bad_request", message: "Invalid JSON body" },
        { status: 400 }
      );
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

    const safeCompany = companyRaw?.trim() ? companyRaw.trim() : "（未指定）";

    // =========================
    // ✅ 0) generation_jobs upsert（recovery/idempotency）
    // =========================
    const { data: existing, error: exErr } = await supabase
      .from("generation_jobs")
      .select("id, status, result")
      .eq("auth_user_id", authUserId)
      .eq("feature_id", FEATURE_ID)
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

    if (exErr) {
      console.error(`[es-eval:${requestId}] job lookup error`, exErr);
      return NextResponse.json({ ok: false, error: "db_error" }, { status: 500 });
    }

    if (existing?.status === "succeeded" && existing?.result) {
      return NextResponse.json({ ok: true, ...(existing.result as any), reused: true });
    }

    const jobRequest = {
      text: truncatedText,
      company: safeCompany,
      qType: safeQType,
      limit: safeLimit,
    };

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
          updated_at: new Date().toISOString(),
        },
        { onConflict: "auth_user_id,feature_id,idempotency_key" }
      )
      .select("id, status")
      .single();

    if (upErr || !upserted?.id) {
      console.error(`[es-eval:${requestId}] job upsert error`, upErr);
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
      body: JSON.stringify({ feature: USAGE_FEATURE_KEY }),
    });

    const checkBody: any = await checkRes.json().catch(() => ({}));

    if (!checkRes.ok) {
      if (checkRes.status === 402 && checkBody?.error === "need_meta") {
        const requiredMeta = Number(checkBody?.requiredMeta ?? 1);

        // ✅ confirm前は 402 で止める（課金しない）
        if (!metaConfirm) {
          await supabase
            .from("generation_jobs")
            .update({
              status: "blocked",
              error_code: "need_meta",
              error_message: "need_meta_before_confirm",
              updated_at: new Date().toISOString(),
            })
            .eq("id", jobId);

          return NextResponse.json({ ok: false, error: "need_meta", requiredMeta }, { status: 402 });
        }
        // ✅ confirm後は続行（後段で残高最終防衛）
      } else if (checkRes.status === 401) {
        return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
      } else {
        console.error(`[es-eval:${requestId}] usage/check unexpected`, checkRes.status, checkBody);
        return NextResponse.json({ ok: false, error: "usage_error" }, { status: 500 });
      }
    }

    const proceedMode: "unlimited" | "free" | "need_meta" =
      checkBody?.mode ?? (metaConfirm ? "need_meta" : "free");

    const requiredMeta = Number(checkBody?.requiredMeta ?? 1);

    // =========================
    // ✅ 1.5) confirm後の最終防衛：残高不足なら OpenAI を叩かない
    // ✅ 残高は meta_lots 集計RPC（get_my_meta_balance）を真実にする
    // =========================
    if (proceedMode === "need_meta" && metaConfirm) {
      const { data: mbData, error: mbErr } = await supabase.rpc("get_my_meta_balance");

      // 返り値 shape 吸収（number / {balance} / {meta_balance} など）
      let bal = 0;
      if (!mbErr) {
        if (typeof mbData === "number") bal = mbData;
        else if (mbData && typeof mbData === "object") {
          const anyData = mbData as any;
          const v = anyData.balance ?? anyData.meta_balance ?? anyData.metaBalance ?? anyData.value ?? 0;
          bal = Number(v);
        } else {
          bal = Number(mbData ?? 0);
        }
      }

      if (mbErr || !Number.isFinite(bal) || bal < requiredMeta) {
        await supabase
          .from("generation_jobs")
          .update({
            status: "blocked",
            error_code: "need_meta",
            error_message: mbErr ? "meta_balance_rpc_error" : "insufficient_meta_after_confirm",
            updated_at: new Date().toISOString(),
          })
          .eq("id", jobId);

        return NextResponse.json(
          { ok: false, error: "need_meta", requiredMeta, balance: Number.isFinite(bal) ? bal : null },
          { status: 402 }
        );
      }
    }

    // =========================
    // ✅ 2) OpenAI（採点が振れるプロンプト）
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

【企業名】:${safeCompany}
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
      console.error(`[es-eval:${requestId}] OpenAI API error:`, data);

      await supabase
        .from("generation_jobs")
        .update({
          status: "failed",
          error_code: "openai_error",
          error_message: JSON.stringify(data)?.slice(0, 4000) ?? "openai_error",
          updated_at: new Date().toISOString(),
        })
        .eq("id", jobId);

      return NextResponse.json({ ok: false, error: "openai_error" }, { status: 500 });
    }

    const content = data?.choices?.[0]?.message?.content;
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

      return NextResponse.json({ ok: false, error: "openai_empty" }, { status: 500 });
    }

    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      await supabase
        .from("generation_jobs")
        .update({
          status: "failed",
          error_code: "json_parse_error",
          error_message: content.slice(0, 2000),
          updated_at: new Date().toISOString(),
        })
        .eq("id", jobId);

      return NextResponse.json({ ok: false, error: "parse_error" }, { status: 500 });
    }

    const s = parsed?.score;
    const f = parsed?.feedback;

    if (!s || typeof s.structure !== "number" || !f) {
      await supabase
        .from("generation_jobs")
        .update({
          status: "failed",
          error_code: "invalid_shape",
          error_message: JSON.stringify(parsed)?.slice(0, 2000) ?? "invalid_shape",
          updated_at: new Date().toISOString(),
        })
        .eq("id", jobId);

      return NextResponse.json({ ok: false, error: "invalid_shape" }, { status: 500 });
    }

    const result: EvalResult = {
      score: {
        structure: Number(s.structure),
        logic: Number(s.logic),
        clarity: Number(s.clarity),
        companyFit: Number(s.companyFit),
        lengthFit: Number(s.lengthFit),
      },
      feedback: {
        summary: String(f?.summary ?? ""),
        strengths: Array.isArray(f?.strengths) ? f.strengths.map(String) : [],
        improvements: Array.isArray(f?.improvements) ? f.improvements.map(String) : [],
        checklist: Array.isArray(f?.checklist) ? f.checklist.map(String) : [],
        sampleStructure: String(f?.sampleStructure ?? ""),
      },
    };

    // =========================
    // ✅ 3) 成功判定 = generation_jobs に result 保存できた
    // =========================
    const { error: saveErr } = await supabase
      .from("generation_jobs")
      .update({
        status: "succeeded",
        result,
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    if (saveErr) {
      console.error(`[es-eval:${requestId}] result save failed`, saveErr);
      return NextResponse.json({ ok: false, error: "result_save_failed" }, { status: 500 });
    }

    // =========================
    // ✅ 4) 成功後だけ課金
    // =========================
    if (proceedMode === "free") {
      await fetch(`${baseUrl}/api/usage/log`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookieHeader },
        body: JSON.stringify({ feature: USAGE_FEATURE_KEY, jobId }),
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
            error_code: "need_meta",
            error_message: `meta_charge_failed:${String(consumeErr.message ?? "").slice(0, 200)}`,
            updated_at: new Date().toISOString(),
          })
          .eq("id", jobId);

        return NextResponse.json({ ok: false, error: "need_meta", requiredMeta }, { status: 402 });
      }
    }

    // =========================
    // ✅ 5) 既存ログ保存（あなたのDBに合わせて維持）
    // =========================
    const nowIso = new Date().toISOString();
    const avg = avgScore5(result.score);
    const avgScore = Number.isFinite(avg as any) ? (avg as number) : 0;

    // 一覧で見やすいように summary+要点を軽く整形
    const afterText = [
      `【要約】${String(result.feedback.summary ?? "").trim()}`,
      "",
      `【強み】${Array.isArray(result.feedback.strengths) ? result.feedback.strengths.join(" / ") : ""}`,
      `【改善】${Array.isArray(result.feedback.improvements) ? result.feedback.improvements.join(" / ") : ""}`,
    ]
      .filter(Boolean)
      .join("\n");

    try {
      const { error: logErr } = await supabase.from("es_logs").insert({
        user_id: authUserId,
        profile_id: authUserId,
        company_name: safeCompany,
        es_question: safeQType,
        mode: "eval",
        score: avgScore,
        es_before: truncatedText,
        es_after: afterText,
        created_at: nowIso,
      });

      if (logErr) console.error("es_logs insert error (es/eval):", logErr);
    } catch (e) {
      console.error("es_logs insert crash (es/eval):", e);
    }

    try {
      await supabase.from("growth_logs").insert({
        user_id: authUserId,
        source: "es_correction",
        title: `${safeCompany !== "（未指定）" ? `ES評価：${safeCompany}` : "ES評価"} [Score]`,
        description: "ESのスコアリングとフィードバックを生成しました。",
        metadata: {
          mode: "eval",
          feature: GATE_FEATURE_ID,
          company: safeCompany,
          qType: safeQType,
          limit: safeLimit,
          model: OPENAI_MODEL_ES,
          scores: result.score,
          jobId,
          idempotencyKey,
          proceedMode,
          requiredMeta,
        },
        created_at: nowIso,
      });
    } catch (e) {
      console.error("growth_logs insert error (es/eval):", e);
    }

    return NextResponse.json({
      ok: true,
      ...result,
      jobId,
      idempotencyKey,
      proceedMode,
    });
  } catch (e) {
    console.error("POST /api/es/eval error:", e);
    return NextResponse.json({ ok: false, error: "server_error", message: "server error" }, { status: 500 });
  }
}
