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

type FeatureId = "case_generate"; // ✅ 生成はこっち（usage/check の key と揃える）

type CaseQuestion = {
  id: string;
  domain: CaseDomain;
  pattern: CasePattern;
  title: string;
  client: string;
  prompt: string;
  hint: string;
  kpiExamples: string;
};

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

function clampInt(n: any, min: number, max: number, fallback: number) {
  const x = Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(x)));
}

function normalizeOne(
  raw: any,
  domain: CaseDomain,
  pattern: CasePattern,
  idx: number
): CaseQuestion | null {
  if (!raw || typeof raw !== "object") return null;

  const id = String(raw.id ?? "").trim();
  const title = String(raw.title ?? "").trim();
  const client = String(raw.client ?? "").trim();
  const prompt = String(raw.prompt ?? "").trim();
  const hint = String(raw.hint ?? "").trim();
  const kpiExamples = String(raw.kpiExamples ?? "").trim();

  if (!title || !client || !prompt) return null;

  // id が無い/短い場合は補完
  const safeId =
    id && id.length >= 6
      ? id
      : `case_${domain}_${pattern}_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 8)}`;

  return {
    id: safeId,
    domain,
    pattern,
    title,
    client,
    prompt,
    hint: hint || "（ヒントなし）",
    kpiExamples: kpiExamples || "（KPI例なし）",
  };
}

function uniqById(arr: CaseQuestion[]) {
  const seen = new Set<string>();
  const out: CaseQuestion[] = [];
  for (const x of arr) {
    if (!x?.id) continue;
    let id = x.id;
    if (seen.has(id)) {
      id = `${id}_${Math.random().toString(36).slice(2, 6)}`;
    }
    seen.add(id);
    out.push({ ...x, id });
  }
  return out;
}

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

    // ✅ 入力（domain/pattern/count）
    const body = (await req.json().catch(() => null)) as
      | { domain?: CaseDomain; pattern?: CasePattern; count?: number }
      | null;

    const domain = body?.domain;
    const pattern = body?.pattern;
    const count = clampInt(body?.count, 1, 20, 10); // ✅ デフォ10（上限20にしておく）

    if (!isValidDomain(domain) || !isValidPattern(pattern)) {
      return NextResponse.json(
        { ok: false, error: "bad_request", message: "domain / pattern is required" },
        { status: 400 }
      );
    }

    const feature: FeatureId = "case_generate";

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

        // ✅ confirm後は “実行は許可” する（課金は成功後）
        // ここで止めない。後段の consume_meta_fifo が失敗したら 402 を返す。
      } else if (checkRes.status === 401) {
        return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
      } else {
        console.error("usage/check unexpected", checkRes.status, checkBody);
        return NextResponse.json({ ok: false, error: "usage_error" }, { status: 500 });
      }
    }

    const proceedMode: "unlimited" | "free" | "need_meta" =
      checkBody?.mode ?? "free";
    const requiredMeta = Number(checkBody?.requiredMeta ?? 1);

    // =========================
    // ✅ 2) OpenAI（ケース生成：まとめて count 件）
    // =========================
    const system = `
あなたはケース面接の出題者。日本語。現実のビジネス文脈。
必ず「JSONのみ」で返す（前後に文章を付けない）。
次の形で返す：
{
  "cases": [ ... ]
}
cases は必ず指定件数ぶん生成する。id は英数字と_。prompt は4〜10行。
`.trim();

    const userPrompt = `
domain: ${domain}
pattern: ${pattern}
count: ${count}

次のJSONを返して：
{
  "cases": [
    {
      "id": "一意っぽいid（英数字と_）",
      "domain": "${domain}",
      "pattern": "${pattern}",
      "title": "短いタイトル",
      "client": "クライアント名（具体的に）",
      "prompt": "受験者への指示（4〜10行、曖昧すぎない）",
      "hint": "分解のヒント（1〜3行）",
      "kpiExamples": "見るべきKPI例（改行OK）"
    }
  ]
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
        temperature: 0.8,
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
    const obj = safeJsonParse(content);

    const rawCases: any[] = Array.isArray(obj?.cases) ? obj.cases : [];
    const normalized = rawCases
      .map((c, i) => normalizeOne(c, domain, pattern, i))
      .filter(Boolean) as CaseQuestion[];

    const cases = uniqById(normalized).slice(0, count);

    if (!cases.length) {
      return NextResponse.json(
        { ok: false, error: "invalid_response", message: "生成結果が不正です（casesがありません）" },
        { status: 500 }
      );
    }

    // =========================
    // ✅ 3) 成功後だけ課金
    // =========================
    if (proceedMode === "free") {
      // free枠があるなら usage/log
      await fetch(`${baseUrl}/api/usage/log`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookieHeader },
        body: JSON.stringify({ feature }),
      }).catch(() => {});
    } else if (proceedMode === "need_meta") {
      // ✅ metaConfirm していないなら、本当はここまで来ない想定だけど念のため
      if (!metaConfirm) {
        return NextResponse.json(
          { ok: false, error: "need_meta", requiredMeta },
          { status: 402 }
        );
      }

      // ✅ 成功後にだけ課金
      const { error: consumeErr } = await supabaseAdmin.rpc("consume_meta_fifo", {
        p_auth_user_id: authUserId,
        p_cost: requiredMeta,
      });

      if (consumeErr) {
        // 残高不足など → 402 にしてUI側で購入導線へ
        console.error("consume_meta_fifo failed:", consumeErr);
        return NextResponse.json(
          { ok: false, error: "need_meta", requiredMeta, message: "METAが不足しています。" },
          { status: 402 }
        );
      }
    }

    // ✅ 互換：単体caseも返す（UI側がまだ単体前提でも死なない）
    return NextResponse.json({
      ok: true,
      mode: proceedMode,
      requiredMeta,
      case: cases[0],
      cases,
      count: cases.length,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { ok: false, error: "server_error", message: "server error" },
      { status: 500 }
    );
  }
}
