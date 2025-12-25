// app/api/eval/fermi/route.ts
import { NextResponse } from "next/server";
import { createServerSupabase } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserPlan } from "@/lib/plan";
import { requireFeatureOrConsumeMeta } from "@/lib/payment/featureGate";

export const runtime = "nodejs";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL_EVAL = process.env.OPENAI_MODEL_EVAL_FERMI || "gpt-4o-mini";

type FermiFactor = {
  id: number;
  name: string;
  operator: "×" | "+";
  assumption: string;
  rationale: string;
  value: string;
};

function clamp0to10(n: any) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(10, Math.round(x)));
}

function safeJsonParse(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    const m = s.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("Invalid JSON from model");
    return JSON.parse(m[0]);
  }
}

export async function POST(req: Request) {
  try {
    if (!OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "server_config", message: "OPENAI_API_KEY is not set" },
        { status: 500 }
      );
    }

    // ✅ cookieセッションから本人確定（body.userIdは信じない）
    const supabase = await createServerSupabase(); // ←await 必須
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return NextResponse.json(
        { error: "unauthorized", message: "login required" },
        { status: 401 }
      );
    }
    const userId = user.id;

    // ✅ body
    const body = (await req.json()) as {
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

    const { question, formula, unit, factors, sanityComment } = body;

    if (!question || !formula || !unit || !Array.isArray(factors)) {
      return NextResponse.json(
        {
          error: "bad_request",
          message: "question/formula/unit/factors is required",
        },
        { status: 400 }
      );
    }

    // ✅ usage/consume：Route Handler → 内部fetchは cookie が勝手に付かない
    // → 元リクエストの Cookie を転送する
    const baseUrl = new URL(req.url).origin;
    const cookieHeader = req.headers.get("cookie") ?? "";

    const usageRes = await fetch(`${baseUrl}/api/usage/consume`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
      },
      body: JSON.stringify({ feature: "fermi" }), // usage側のFeatureKey
    });

    const usageJson = await usageRes.json().catch(() => null);

    // ✅ 無料枠を超えていたら → meta消費へ誘導
    if (!usageRes.ok) {
      // 402 で need_meta を返す想定（あなたが今直してる usage/consume の仕様）
      if (usageRes.status === 402 && usageJson?.error === "need_meta") {
        // ✅ meta消費（meta_lots / consume_meta_fifo）
        // ※ FeatureGate側のFeatureIdは「fermi」を使う（あなたのFEATURE_META_COSTに合わせる）
        const gate = await requireFeatureOrConsumeMeta("fermi");

        // meta不足なら、ここでそのまま返す（UIは購入導線へ）
        if (!gate.ok) {
          return NextResponse.json(gate, { status: gate.status });
        }

        // gate.ok なら「metaで続行できた」ので本処理へ進む
      } else {
        // それ以外は usage側の想定外エラー
        console.error("usage/consume error:", usageRes.status, usageJson);
        return NextResponse.json(
          { error: "usage_error", message: "Failed to check usage" },
          { status: 500 }
        );
      }
    }

    // ✅ ここまで来たら「無料枠内 or meta消費済み or pro」なので実行OK
    const plan = await getUserPlan(userId);

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
        messages: [
          { role: "system", content: system },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!r.ok) {
      const t = await r.text();
      console.error("OpenAI error:", t);
      return NextResponse.json(
        { error: "openai_error", message: "OpenAI API error" },
        { status: 500 }
      );
    }

    const j = await r.json();
    const content = j?.choices?.[0]?.message?.content ?? "";
    const parsed = safeJsonParse(content);

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
      totalScore, // ←モデルの値は信用せず、計算値で上書き
    };

    const insertPayload: any = {
      user_id: userId,
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

    // ✅ A: RLSでinsert（ポリシー必要）
    let insertRes = await supabase
      .from("fermi_sessions")
      .insert(insertPayload)
      .select("id")
      .single();

    // ✅ B: 保険（RLSがまだ/壊れてる時だけ）
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

    return NextResponse.json({
      ok: true,
      plan,

      // usage/consume が200のときのみ意味がある（need_metaのときは usageJson は {error:"need_meta", ...}）
      usedThisMonth:
        typeof usageJson?.usedThisMonth === "number" ? usageJson.usedThisMonth : null,
      freeLimit: typeof usageJson?.freeLimit === "number" ? usageJson.freeLimit : null,

      score,
      feedback,
      totalScore,
      logId: insertRes.data?.id ?? null,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "server_error", message: "server error" },
      { status: 500 }
    );
  }
}
