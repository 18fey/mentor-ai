// app/api/eval/fermi/route.ts
import { NextResponse } from "next/server";
import { createServerSupabase } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserPlan } from "@/lib/plan";

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

export async function POST(req: Request) {
  try {
    if (!OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "server_config", message: "OPENAI_API_KEY is not set" },
        { status: 500 }
      );
    }

    // ✅ cookieセッションから「本人」を確定（body.userIdは信じない）
    const supabase = createServerSupabase();
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const userId = user.id;

    const body = (await req.json()) as {
      question: string;
      formula: string;
      unit: string;
      factors: FermiFactor[];
      sanityComment: string;
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

    const plan = await getUserPlan(userId);

    const system = `
あなたはフェルミ推定の面接官。日本語で辛口だが建設的。
必ずJSONのみで返す（前後に文章を付けない）。
スコアは0〜10の整数（5軸）。totalScoreは5軸の合計（0〜50）。
strengths/weaknessesは配列（3〜6個）。
sampleAnswerは「短い模範（手順＋代表値＋結論）」を示す。
`;

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
`;

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
          { role: "system", content: system.trim() },
          { role: "user", content: userPrompt.trim() },
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

    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      const m = content.match(/\{[\s\S]*\}/);
      if (!m) throw new Error("Invalid JSON from model");
      parsed = JSON.parse(m[0]);
    }

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
      totalScore,
    };

    const insertPayload = {
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
        sanityComment,
        result: body.result ?? null,
        feedback,
      },
    };

    // ✅ 第一候補：RLSを通してinsert（ポリシーが正しければ通る）
    let insErr = (await supabase.from("fermi_sessions").insert(insertPayload)).error;

    // ✅ 保険：どうしてもダメならadminでinsert（運用で選ぶ）
    if (insErr) {
      console.error("fermi_sessions insert error (authed):", insErr);
      const adminRes = await supabaseAdmin.from("fermi_sessions").insert(insertPayload);
      if (adminRes.error) {
        console.error("fermi_sessions insert error (admin):", adminRes.error);
      } else {
        insErr = null;
      }
    }

    return NextResponse.json({
      ok: true,
      plan,
      score,
      feedback,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
