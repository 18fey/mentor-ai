// app/api/industry-insights/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = "gpt-4.1-mini";

// service role（Route内だけ）
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type Database = any;
type FeatureId = "industry_insight";

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

type InsightResult = { insight: string; questions: string; news: string };

function safeStr(v: unknown, maxLen: number) {
  if (typeof v !== "string") return "";
  return v.slice(0, maxLen);
}

function rid() {
  return Math.random().toString(36).slice(2, 10);
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

    // ✅ meta confirm（モーダル confirm 後だけ true で来る）
    const metaConfirm =
      req.headers.get("x-meta-confirm") === "1" ||
      req.headers.get("X-Meta-Confirm") === "1";

    // ✅ 入力
    const body = (await req.json().catch(() => ({}))) as {
      industryGroup: string;
      industrySub?: string | null;
      targetCompany?: string | null;
      focusTopic?: string | null;
      includeNews?: boolean;
    };

    const industryGroup = safeStr(body.industryGroup, 80);
    const industrySub = safeStr(body.industrySub, 80) || null;
    const targetCompany = safeStr(body.targetCompany, 120) || null;
    const focusTopic = safeStr(body.focusTopic, 200) || null;
    const includeNews = Boolean(body.includeNews);

    if (!industryGroup) {
      return NextResponse.json(
        { ok: false, error: "bad_request", message: "industryGroup is required" },
        { status: 400 }
      );
    }

    const feature: FeatureId = "industry_insight";

    // =========================
    // ✅ 0) generation_jobs upsert
    // =========================
    // 既に succeeded なら即返す（再実行しない）
    const { data: existing, error: exErr } = await supabase
      .from("generation_jobs")
      .select("id, status, result")
      .eq("auth_user_id", authUserId)
      .eq("feature_id", feature)
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

    if (exErr) {
      console.error(`[industry:${requestId}] job lookup error`, exErr);
      return NextResponse.json({ ok: false, error: "db_error" }, { status: 500 });
    }

    if (existing?.status === "succeeded" && existing?.result) {
      return NextResponse.json({ ok: true, ...existing.result, reused: true });
    }

    // なければ作成、あれば running に更新
    const jobRequest = {
      industryGroup,
      industrySub,
      targetCompany,
      focusTopic,
      includeNews,
    };

    const { data: upserted, error: upErr } = await supabase
      .from("generation_jobs")
      .upsert(
        {
          auth_user_id: authUserId,
          feature_id: feature,
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
      console.error(`[industry:${requestId}] job upsert error`, upErr);
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
      body: JSON.stringify({ feature: feature }),
    });

    const checkBody: any = await checkRes.json().catch(() => ({}));

    if (!checkRes.ok) {
      if (checkRes.status === 402 && checkBody?.error === "need_meta") {
        const requiredMeta = Number(checkBody?.requiredMeta ?? 1);

        // ✅ confirm 前は 402 を返して止める（課金はしない）
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

          return NextResponse.json(
            { ok: false, error: "need_meta", requiredMeta },
            { status: 402 }
          );
        }
        // ✅ confirm 後は続行（ただし後段で残高チェックを挟む）
      } else if (checkRes.status === 401) {
        return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
      } else {
        console.error(`[industry:${requestId}] usage/check unexpected`, checkRes.status, checkBody);
        return NextResponse.json({ ok: false, error: "usage_error" }, { status: 500 });
      }
    }

    const proceedMode: "unlimited" | "free" | "need_meta" =
      checkBody?.mode ?? (metaConfirm ? "need_meta" : "free");

    const requiredMeta = Number(checkBody?.requiredMeta ?? 2);

    // =========================
    // ✅ 1.5) confirm後の“最終防衛”：残高が足りないなら OpenAI を叩かない
    //     残高参照を RPC get_my_meta_balance に統一（meta_lots 集計が真実）
    // =========================
    if (proceedMode === "need_meta" && metaConfirm) {
      const { data: mbData, error: mbErr } = await supabase.rpc("get_my_meta_balance");

      // RPCの返り値 shape 吸収（number / {balance} / {meta_balance} 等）
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
        await supabase
          .from("generation_jobs")
          .update({
            status: "blocked",
            error_code: "need_meta",
            error_message: mbErr
              ? "meta_balance_rpc_error"
              : "insufficient_meta_after_confirm",
            updated_at: new Date().toISOString(),
          })
          .eq("id", jobId);

        return NextResponse.json(
          {
            ok: false,
            error: "need_meta",
            requiredMeta,
            balance: Number.isFinite(bal) ? bal : null,
          },
          { status: 402 }
        );
      }
    }

    // =========================
    // ✅ 2) OpenAI
    // =========================
    const industryLine = industrySub
      ? `対象業界: ${industryGroup} / ${industrySub}`
      : `対象業界: ${industryGroup}`;

    const companyPart = targetCompany ? `志望企業: ${targetCompany}` : "志望企業: 特に指定なし";
    const focusPart = focusTopic ? `特に深掘りしたいテーマ: ${focusTopic}` : "特に深掘りしたいテーマ: 特になし";

    const newsPart = includeNews
      ? "直近1〜2年のニュース・トレンドも整理してください。"
      : "ニュース・トレンドは簡潔で構いません。";

    const systemPrompt = `
あなたは日本の就活生向けに、
「業界構造 × 個別企業の強み/弱み × 将来性（中期リスク） × 直近トレンド」
を統合して整理するプロフェッショナルキャリアメンターです。

出力は必ず JSON 形式「のみ」で行ってください。前後に説明文は書かないでください。

JSON の形式は次の通りです：

{
  "insight": "業界構造・ビジネスモデル・個別企業の位置づけ・強み/弱み・将来性（Markdown 可）",
  "questions": "想定質問リストと答え方のポイント（Markdown 可）",
  "news": "直近ニュース・トレンドと面接での語り方（Markdown 可）"
}

・コードブロックで囲まず、純粋な JSON テキストだけを出力してください。
・「insight」「questions」「news」の3フィールドは必ず含めてください。
`.trim();

    const userPrompt = `
${industryLine}
${companyPart}
${focusPart}

要件:
- 就活の面接準備に直接使えるレベルで、できるだけ具体的に。
- 日本語で出力。
- 大学3〜4年生が読んで理解しやすいトーンで。
- "insight" / "questions" / "news" で、情報が被りすぎないようにしてください。
- insight では、業界構造（プレーヤー・収益源・規制・リスク）、主要論点、個別企業の位置づけに加えて、
  「強み」「弱み」「中期3〜5年の将来性（追い風・向かい風・構造的リスク）」も整理してください。
- questions では、面接で実際に聞かれそうな質問と、答え方のポイントを 10〜15 個まとめてください。
- news では、就活生が押さえておくべき直近トレンド・ニュースと、それをどう語るかのヒントを書いてください。
${newsPart}
`.trim();

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
        temperature: 0.55,
      }),
    });

    if (!r.ok) {
      const errText = await r.text().catch(() => "");
      console.error(`[industry:${requestId}] openai error`, errText);

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
      parsed = JSON.parse(content);
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

    const result: InsightResult = {
      insight: String(parsed?.insight ?? "インサイト情報を取得できませんでした。"),
      questions: String(parsed?.questions ?? "想定質問情報を取得できませんでした。"),
      news: String(parsed?.news ?? "ニュース情報を取得できませんでした。"),
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
      console.error(`[industry:${requestId}] result save failed`, saveErr);
      // ここで課金しない（＝事故回避）
      return NextResponse.json({ ok: false, error: "result_save_failed" }, { status: 500 });
    }

    // =========================
    // ✅ 4) 成功後だけ課金（free: usage/log / meta: consume_meta_fifo）
    // =========================
    if (proceedMode === "free") {
      await fetch(`${baseUrl}/api/usage/log`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookieHeader },
        body: JSON.stringify({ feature: feature, jobId }),
      }).catch(() => {});
    } else if (proceedMode === "need_meta" && metaConfirm) {
      const { error: consumeErr } = await supabaseAdmin.rpc("consume_meta_fifo", {
        p_auth_user_id: authUserId,
        p_cost: requiredMeta,
      });

      // ✅ ここが課金導線の肝：失敗したら結果を渡さず 402 で戻す
      if (consumeErr) {
        await supabase
          .from("generation_jobs")
          .update({
            error_code: "need_meta",
            error_message: `meta_charge_failed:${String(consumeErr.message ?? "").slice(0, 200)}`,
            updated_at: new Date().toISOString(),
          })
          .eq("id", jobId);

        return NextResponse.json(
          { ok: false, error: "need_meta", requiredMeta },
          { status: 402 }
        );
      }
    }

    // =========================
    // ✅ 5) 分析ログ（今のまま維持）
    // =========================
    const nowIso = new Date().toISOString();

    try {
      await supabase.from("growth_logs").insert({
        user_id: authUserId,
        source: "industry_insight",
        title: `業界インサイト：${industryGroup}${industrySub ? ` / ${industrySub}` : ""}`,
        description: "業界構造・企業論点・想定質問・ニュース整理を生成しました。",
        metadata: {
          feature: "industry_insight",
          jobId,
          idempotencyKey,
          industryGroup,
          industrySub,
          targetCompany,
          focusTopic,
          includeNews,
          proceedMode,
        },
        created_at: nowIso,
      });
    } catch {}

    try {
      await supabase.from("industry_research_logs").insert({
        user_id: authUserId,
        industry_group: industryGroup,
        industry_sub: industrySub,
        target_company: targetCompany,
        focus_topic: focusTopic,
        include_news: includeNews,
        result,
        created_at: nowIso,
      });
    } catch {}

    return NextResponse.json({
      ok: true,
      ...result,
      jobId,
      idempotencyKey,
    });
  } catch (error: any) {
    console.error("Industry Insights API error:", error);
    return NextResponse.json(
      { ok: false, error: "server_error", message: "インサイト生成に失敗しました" },
      { status: 500 }
    );
  }
}
