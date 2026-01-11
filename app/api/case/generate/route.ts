// app/api/case/generate/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/utils/supabase/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL_GEN = process.env.OPENAI_MODEL_GEN_CASE || "gpt-4o-mini";

// service role（Route内だけ）
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type CaseDomain = "consulting" | "general" | "trading" | "ib";
type CasePattern = "market_sizing" | "profitability" | "entry" | "new_business" | "operation";

type FeatureId = "case_interview";

function safeJsonParse(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    const m = s.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("Invalid JSON from model");
    return JSON.parse(m[0]);
  }
}

const isValidDomain = (v: any): v is CaseDomain =>
  v === "consulting" || v === "general" || v === "trading" || v === "ib";

const isValidPattern = (v: any): v is CasePattern =>
  v === "market_sizing" ||
  v === "profitability" ||
  v === "entry" ||
  v === "new_business" ||
  v === "operation";

export async function POST(req: NextRequest) {
  try {
    if (!OPENAI_API_KEY) {
      return NextResponse.json(
        { ok: false, error: "server_config", message: "OPENAI_API_KEY is not set" },
        { status: 500 }
      );
    }

    // ✅ cookieセッションから本人確定（最重要）
    const supabase = createServerSupabase();
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user?.id) {
      return NextResponse.json(
        { ok: false, error: "unauthorized", message: "ログインが必要です。" },
        { status: 401 }
      );
    }
    const authUserId = user.id;

    // ✅ meta confirm（confirm後だけ true）
    const metaConfirm =
      req.headers.get("x-meta-confirm") === "1" ||
      req.headers.get("X-Meta-Confirm") === "1";

    // ✅ 入力（domain/patternのみ）
    const body = (await req.json().catch(() => null)) as
      | { domain?: CaseDomain; pattern?: CasePattern }
      | null;

    const domain = body?.domain;
    const pattern = body?.pattern;

    if (!isValidDomain(domain) || !isValidPattern(pattern)) {
      return NextResponse.json(
        { ok: false, error: "bad_request", message: "domain / pattern is required" },
        { status: 400 }
      );
    }

    const feature: FeatureId = "case_interview";

    // =========================
    // ✅ 1) usage/check（消費しない）
    // =========================
    const baseUrl = new URL(req.url).origin;
    const cookieHeader = req.headers.get("cookie") ?? "";

    const checkRes = await fetch(`${baseUrl}/api/usage/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieHeader },
      body: JSON.stringify({ feature }),
    });

    const checkBody: any = await checkRes.json().catch(() => ({}));

    if (!checkRes.ok) {
      if (checkRes.status === 402 && checkBody?.error === "need_meta") {
        const requiredMeta = Number(checkBody?.requiredMeta ?? 1);

        // ✅ confirm前は止める（課金しない）
        if (!metaConfirm) {
          return NextResponse.json(
            { ok: false, error: "need_meta", requiredMeta },
            { status: 402 }
          );
        }

        // ✅ confirm後でも残高不足なら、ここで止めるのが安全
        // （UI側は /api/meta/balance で purchase モードにして /pricing へ）
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

    const proceedMode: "unlimited" | "free" | "need_meta" =
      checkBody?.mode ?? "free";
    const requiredMeta = Number(checkBody?.requiredMeta ?? 1);

    // =========================
    // ✅ 2) OpenAI（ケース生成）
    // =========================
    const system = `
あなたはケース面接の出題者。日本語。現実のビジネス文脈。
必ず「JSONのみ」で返す（前後に文章を付けない）。
`.trim();

    const userPrompt = `
domain: ${domain}
pattern: ${pattern}

次のJSONでケース問題を1つ生成して：
{
  "id": "一意っぽいid（英数字と_）",
  "domain": "${domain}",
  "pattern": "${pattern}",
  "title": "短いタイトル",
  "client": "クライアント名（具体的に）",
  "prompt": "受験者への指示（4〜8行、曖昧すぎない）",
  "hint": "分解のヒント（1〜3行）",
  "kpiExamples": "見るべきKPI例（改行OK）"
}
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
      return NextResponse.json(
        { ok: false, error: "openai_error", message: "OpenAI API error" },
        { status: 500 }
      );
    }

    const j = await r.json();
    const content = j?.choices?.[0]?.message?.content ?? "";
    const caseObj = safeJsonParse(content);

    // =========================
    // ✅ 3) 成功後だけ課金
    // =========================
    if (proceedMode === "free") {
      // free枠があるなら usage/log に寄せる（あなたの既存ロジックに合わせる）
      await fetch(`${baseUrl}/api/usage/log`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookieHeader },
        body: JSON.stringify({ feature }),
      }).catch(() => {});
    } else if (proceedMode === "need_meta" && metaConfirm) {
      // Meta課金
      const { error: consumeErr } = await supabaseAdmin.rpc("consume_meta_fifo", {
        p_auth_user_id: authUserId,
        p_cost: requiredMeta,
      });

      if (consumeErr) {
        // ここで失敗したら、ケースは返しちゃってるので「返す前に課金」をしたいなら順序を入れ替える
        // ただしその場合、OpenAI失敗で課金される事故が起きる
        console.error("consume_meta_fifo failed:", consumeErr);
      }
    }

    return NextResponse.json({
      ok: true,
      mode: proceedMode,
      requiredMeta,
      case: caseObj,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { ok: false, error: "server_error", message: "server error" },
      { status: 500 }
    );
  }
}
