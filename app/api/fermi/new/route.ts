// app/api/fermi/new/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL_GEN = process.env.OPENAI_MODEL_GEN_FERMI || "gpt-4o-mini";

type FermiCategory = "daily" | "business" | "consulting";
type FermiDifficulty = "easy" | "medium" | "hard";

// ✅ usage/check の key と揃える（fermiの生成）
type FeatureId = "fermi_generate";

type FermiProblem = {
  id: string;
  category: FermiCategory;
  difficulty: FermiDifficulty;
  title: string;
  formulaHint: string;
  defaultFactors: string[];
  unit: string;
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

const isValidCategory = (v: any): v is FermiCategory =>
  v === "daily" || v === "business" || v === "consulting";

const isValidDifficulty = (v: any): v is FermiDifficulty =>
  v === "easy" || v === "medium" || v === "hard";

function clampInt(n: any, min: number, max: number, fallback: number) {
  const x = Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(x)));
}

function pickMetaConfirm(req: Request) {
  const v = req.headers.get("x-meta-confirm") || req.headers.get("X-Meta-Confirm");
  return v === "1";
}

function normalizeOne(
  raw: any,
  category: FermiCategory,
  difficulty: FermiDifficulty,
  idx: number
): FermiProblem | null {
  if (!raw || typeof raw !== "object") return null;

  const id = String(raw.id ?? "").trim();
  const title = String(raw.title ?? "").trim();
  const formulaHint = String(raw.formulaHint ?? "").trim();
  const unit = String(raw.unit ?? "").trim();

  const dfRaw = raw.defaultFactors;
  const defaultFactors = Array.isArray(dfRaw)
    ? dfRaw.map((x) => String(x ?? "").trim()).filter(Boolean)
    : [];

  if (!title) return null;

  const safeId =
    id && id.length >= 6
      ? id
      : `fermi_${category}_${difficulty}_${Date.now()}_${idx}_${Math.random()
          .toString(36)
          .slice(2, 8)}`;

  const factors =
    defaultFactors.length >= 3
      ? defaultFactors.slice(0, 5)
      : ["母数（例：人口/世帯数）", "利用率/対象割合", "頻度（回/年）", "単価/金額", "補正要因"].slice(
          0,
          Math.max(3, Math.min(5, defaultFactors.length || 4))
        );

  return {
    id: safeId,
    category,
    difficulty,
    title,
    formulaHint: formulaHint || "例：母数 × 利用割合 × 頻度 × 単価",
    defaultFactors: factors,
    unit: unit || "（単位未指定）",
  };
}

function uniqById(arr: FermiProblem[]) {
  const seen = new Set<string>();
  const out: FermiProblem[] = [];
  for (const x of arr) {
    if (!x?.id) continue;
    let id = x.id;
    if (seen.has(id)) id = `${id}_${Math.random().toString(36).slice(2, 6)}`;
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
    const metaConfirm = pickMetaConfirm(req);

    // ✅ 入力（category/difficulty/count）
    const body = (await req.json().catch(() => null)) as
      | { category?: FermiCategory; difficulty?: FermiDifficulty; count?: number }
      | null;

    const category = body?.category;
    const difficulty = body?.difficulty;

    // ✅ 一度の生成は最大10（デフォ10）
    const count = clampInt(body?.count, 1, 10, 10);

    if (!isValidCategory(category) || !isValidDifficulty(difficulty)) {
      return NextResponse.json(
        { ok: false, error: "bad_request", message: "category / difficulty is required" },
        { status: 400 }
      );
    }

    const feature: FeatureId = "fermi_generate";

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
          return NextResponse.json({ ok: false, error: "need_meta", requiredMeta }, { status: 402 });
        }
        // ✅ confirm後は “実行は許可”（課金は成功後）
      } else if (checkRes.status === 401) {
        return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
      } else {
        console.error("usage/check unexpected", checkRes.status, checkBody);
        return NextResponse.json({ ok: false, error: "usage_error" }, { status: 500 });
      }
    }

    const proceedMode: "unlimited" | "free" | "need_meta" = checkBody?.mode ?? "free";
    const requiredMeta = Number(checkBody?.requiredMeta ?? 1);
    const plan = (checkBody?.plan ?? "free") as any;

    // =========================
    // ✅ 2) OpenAI（フェルミ生成：まとめて count 件）
    // =========================
    const system = `
あなたはフェルミ推定の出題者。日本語。
必ず「JSONのみ」で返す（前後に文章を付けない）。
次の形で返す：
{
  "fermis": [ ... ]
}
fermis は必ず指定件数ぶん生成する。
`.trim();

    const userPrompt = `
category: ${category}
difficulty: ${difficulty}
count: ${count}

次のJSONを返して：
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
      return NextResponse.json(
        { ok: false, error: "openai_error", message: "OpenAI API error" },
        { status: 500 }
      );
    }

    const j = await r.json().catch(() => null);
    const content = j?.choices?.[0]?.message?.content ?? "";

    const obj = safeJsonParse(content);
    const rawFermis: any[] = Array.isArray(obj?.fermis) ? obj.fermis : [];

    const normalized = rawFermis
      .map((f, i) => normalizeOne(f, category, difficulty, i))
      .filter(Boolean) as FermiProblem[];

    const fermis = uniqById(normalized).slice(0, count);

    if (!fermis.length) {
      return NextResponse.json(
        { ok: false, error: "invalid_response", message: "生成結果が不正です（fermisがありません）" },
        { status: 500 }
      );
    }

    // =========================
    // ✅ 3) 成功後だけ課金
    // =========================
    if (proceedMode === "free") {
      await fetch(`${baseUrl}/api/usage/log`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookieHeader },
        body: JSON.stringify({ feature }),
      }).catch(() => {});
    } else if (proceedMode === "need_meta") {
      if (!metaConfirm) {
        return NextResponse.json({ ok: false, error: "need_meta", requiredMeta }, { status: 402 });
      }

      const { error: consumeErr } = await supabaseAdmin.rpc("consume_meta_fifo", {
        p_auth_user_id: authUserId,
        p_cost: requiredMeta,
      });

      if (consumeErr) {
        console.error("consume_meta_fifo failed:", consumeErr);
        return NextResponse.json(
          { ok: false, error: "need_meta", requiredMeta, message: "METAが不足しています。" },
          { status: 402 }
        );
      }
    }

    // ✅ 互換：単体fermiも返す（UIが単体前提でも死なない）
    return NextResponse.json({
      ok: true,
      plan,
      mode: proceedMode,
      requiredMeta,
      fermi: fermis[0],
      fermis,
      count: fermis.length,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { ok: false, error: "server_error", message: "server error" },
      { status: 500 }
    );
  }
}
