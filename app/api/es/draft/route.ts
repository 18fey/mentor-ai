// app/api/es/draft/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL_ES_DRAFT = process.env.OPENAI_MODEL_ES_DRAFT || "gpt-4.1-mini";

// ✅ usage側（/api/usage/check / /api/usage/log）
const USAGE_FEATURE_KEY = "es_draft";
// ✅ meta消費キー
const GATE_FEATURE_ID = "es_draft";

// ✅ generation_jobs feature_id（status復帰で使う）
const FEATURE_ID = "es_draft";

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

type BoostRequestBody = {
  storyCardId?: string;
  text?: string;
  company?: string;
  qType?: string;
  limit?: number;
  userId?: string; // 互換：送られてきても無視
};

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

type DraftResult = {
  score: BoostResult["score"];
  strategy: string;
  keyEdits: string[];
  altOpening: string;
  altClosing: string;
  draft: string;
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
      model: OPENAI_MODEL_ES_DRAFT,
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

    const body = (await req.json().catch(() => null)) as BoostRequestBody | null;
    if (!body) {
      return NextResponse.json(
        { ok: false, error: "bad_request", message: "Invalid JSON body" },
        { status: 400 }
      );
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
      console.error(`[es-draft:${requestId}] job lookup error`, exErr);
      return NextResponse.json({ ok: false, error: "db_error" }, { status: 500 });
    }

    if (existing?.status === "succeeded" && existing?.result) {
      return NextResponse.json({ ok: true, ...(existing.result as any), reused: true });
    }

    const jobRequest = {
      storyCardId: storyCardId || null,
      text: rawText?.trim() ? rawText.trim() : null,
      company: safeCompany,
      qType,
      limit,
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
      console.error(`[es-draft:${requestId}] job upsert error`, upErr);
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
      } else if (checkRes.status === 401) {
        return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
      } else {
        console.error(`[es-draft:${requestId}] usage/check unexpected`, checkRes.status, checkBody);
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
    // ✅ 入力ES本文を確定（カード or 直接本文）
    // =========================
    let baseText = rawText.trim();
    let usedStoryCard: any = null;

    if (storyCardId) {
      const { data: card, error: cardErr } = await supabase
        .from("story_cards")
        .select("*")
        .eq("id", storyCardId)
        .eq("user_id", authUserId)
        .maybeSingle();

      if (cardErr) {
        console.error("story_cards fetch error:", cardErr);
        return NextResponse.json({ ok: false, error: "story_card_fetch_failed" }, { status: 500 });
      }
      if (!card) {
        return NextResponse.json(
          { ok: false, error: "not_found", message: "story card not found" },
          { status: 404 }
        );
      }

      usedStoryCard = card;
      if (!baseText) baseText = buildDraftFromStoryCard(card);
    }

    const MAX_ES_LENGTH = 4000;
    const truncatedText = baseText.length > MAX_ES_LENGTH ? baseText.slice(0, MAX_ES_LENGTH) : baseText;

    // =========================
    // ✅ 2) OpenAI（高精度ドラフト）
    // =========================
    let boost: BoostResult;
    try {
      boost = await callOpenAIForBoost({
        esText: truncatedText,
        company: safeCompany,
        qType,
        limit,
      });
    } catch (e: any) {
      await supabase
        .from("generation_jobs")
        .update({
          status: "failed",
          error_code: "openai_error",
          error_message: String(e?.message ?? e).slice(0, 2000),
          updated_at: new Date().toISOString(),
        })
        .eq("id", jobId);

      return NextResponse.json(
        { ok: false, error: "openai_error", message: "ドラフト生成に失敗しました" },
        { status: 500 }
      );
    }

    const rewriteFull = String(boost.boost.rewrite ?? "").trim();

    const result: DraftResult = {
      score: boost.score,
      strategy: boost.boost.strategy,
      keyEdits: boost.boost.keyEdits,
      altOpening: boost.boost.altOpening,
      altClosing: boost.boost.altClosing,
      draft: rewriteFull,
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
      console.error(`[es-draft:${requestId}] result save failed`, saveErr);
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
    const avg = avgScore5(boost.score);
    const avgScore = Number.isFinite(avg as any) ? (avg as number) : 0;

    try {
      const { error } = await supabase.from("es_logs").insert({
        user_id: authUserId,
        profile_id: authUserId,
        company_name: safeCompany,
        es_question: qType,
        mode: "draft",
        score: avgScore,
        es_before: truncatedText,
        es_after: rewriteFull,
        created_at: nowIso,
      });

      if (error) console.error("es_logs insert error (es/draft):", error);
    } catch (e) {
      console.error("es_logs insert crash (es/draft):", e);
    }

    try {
      const { error: corrErr } = await supabase.from("es_corrections").insert({
        user_id: authUserId,
        profile_id: authUserId,
        story_card_id: storyCardId || null,
        company_name: safeCompany,
        question: qType,
        original_text: truncatedText,
        ai_feedback: {
          score: boost.score,
          boost: {
            strategy: boost.boost.strategy,
            keyEdits: boost.boost.keyEdits,
            altOpening: boost.boost.altOpening,
            altClosing: boost.boost.altClosing,
          },
          meta: {
            mode: "draft",
            company: safeCompany,
            qType,
            limit,
            model: OPENAI_MODEL_ES_DRAFT,
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

    try {
      const safeRole = "（未指定）";
      const { error: tmplErr } = await supabase.from("es_templates").insert({
        user_id: authUserId,
        profile_id: authUserId,
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

    try {
      await supabase.from("growth_logs").insert({
        user_id: authUserId,
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
          scores: boost.score,
          jobId,
          idempotencyKey,
          proceedMode,
          requiredMeta,
        },
        created_at: nowIso,
      });
    } catch (e) {
      console.error("growth_logs insert error (es/draft):", e);
    }

    return NextResponse.json({
      ok: true,
      ...result,
      jobId,
      idempotencyKey,
      proceedMode,
    });
  } catch (e) {
    console.error("POST /api/es/draft error:", e);
    return NextResponse.json({ ok: false, error: "server_error", message: "server error" }, { status: 500 });
  }
}
