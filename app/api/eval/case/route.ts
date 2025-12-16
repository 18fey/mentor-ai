// app/api/eval/case/route.ts
import { NextResponse } from "next/server";
import { getUserPlan } from "@/lib/plan";
import { createServerSupabase } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL_EVAL = process.env.OPENAI_MODEL_EVAL_CASE || "gpt-4o-mini";

type CaseDomain = "consulting" | "general" | "trading" | "ib";
type CasePattern =
  | "market_sizing"
  | "profitability"
  | "entry"
  | "new_business"
  | "operation";

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

type Answers = {
  goal: string;
  kpi: string;
  framework: string;
  hypothesis: string;
  deepDivePlan: string;
  analysis: string;
  solutions: string;
  risks: string;
  wrapUp: string;
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

    // ✅ cookieセッションから本人確定（最重要）
    const supabase = await createServerSupabase(); // ←★await 必須
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const userId = user.id;

    const body = (await req.json()) as {
      case: CaseQuestion;
      answers: Answers;
    };

    const caseQ = body?.case;
    const answers = body?.answers;

    if (!caseQ || !answers) {
      return NextResponse.json(
        { error: "bad_request", message: "case/answers is required" },
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
        Cookie: cookieHeader, // ←★これがないと usage側が unauthorized になる
      },
      body:JSON.stringify({ feature: "case_interview" }),
    });

    const usageJson = await usageRes.json().catch(() => null);

    if (!usageRes.ok) {
      if (usageRes.status === 403 && usageJson?.error === "limit_exceeded") {
        return NextResponse.json(
          {
            error: "limit_exceeded",
            message:
              usageJson?.message ??
              "ケースAIの今月の無料利用回数が上限に達しました。",
          },
          { status: 403 }
        );
      }
      console.error("usage/consume error:", usageRes.status, usageJson);
      return NextResponse.json(
        { error: "usage_error", message: "Failed to check usage" },
        { status: 500 }
      );
    }

    const plan = await getUserPlan(userId);

    const system = `
あなたはケース面接官。日本語で、辛口だが建設的。
必ず「JSONのみ」で返す（前後に文章を付けない）。
スコアは0〜10の整数。
フィードバックは具体例・理由つきで短く鋭く。
`.trim();

    const userPrompt = `
【ケース】
- domain: ${caseQ.domain}
- pattern: ${caseQ.pattern}
- title: ${caseQ.title}
- client: ${caseQ.client}
- prompt: ${caseQ.prompt}
- hint: ${caseQ.hint}
- kpiExamples: ${caseQ.kpiExamples}

【受験者の回答】
- goal: ${answers.goal}
- kpi: ${answers.kpi}
- framework: ${answers.framework}
- hypothesis: ${answers.hypothesis}
- deepDivePlan: ${answers.deepDivePlan}
- analysis: ${answers.analysis}
- solutions: ${answers.solutions}
- risks: ${answers.risks}
- wrapUp: ${answers.wrapUp}

【出力JSONスキーマ（厳守）】
{
  "score": {
    "structure": 0-10,
    "hypothesis": 0-10,
    "insight": 0-10,
    "practicality": 0-10,
    "communication": 0-10
  },
  "feedback": {
    "summary": "全体講評（2〜4行）",
    "goodPoints": "良い点（箇条書き改行OK）",
    "improvePoints": "改善点（理由つきで箇条書き改行OK）",
    "nextTraining": "次の練習（1〜3個、すぐやれる形）"
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

    const score = parsed?.score ?? {};
    const feedback = parsed?.feedback ?? {};

    const normalized = {
      score: {
        structure: clamp0to10(score.structure),
        hypothesis: clamp0to10(score.hypothesis),
        insight: clamp0to10(score.insight),
        practicality: clamp0to10(score.practicality),
        communication: clamp0to10(score.communication),
      },
      feedback: {
        summary: String(feedback.summary ?? ""),
        goodPoints: String(feedback.goodPoints ?? ""),
        improvePoints: String(feedback.improvePoints ?? ""),
        nextTraining: String(feedback.nextTraining ?? ""),
      },
    };

    const totalScore =
      normalized.score.structure +
      normalized.score.hypothesis +
      normalized.score.insight +
      normalized.score.practicality +
      normalized.score.communication;

    const insertPayload: any = {
      user_id: userId,
      problem_id: caseQ.id ?? null,
      domain: caseQ.domain ?? null,
      pattern: caseQ.pattern ?? null,

      problem: JSON.stringify(caseQ),
      answer: JSON.stringify(answers),
      feedback: normalized.feedback,
      score: totalScore,

      goal: answers.goal ?? null,
      kpi: answers.kpi ?? null,
      framework: answers.framework ?? null,
      hypothesis: answers.hypothesis ?? null,
      deep_dive_plan: answers.deepDivePlan ?? null,
      analysis: answers.analysis ?? null,
      solutions: answers.solutions ?? null,
      risks: answers.risks ?? null,
      wrap_up: answers.wrapUp ?? null,

      structure_score: normalized.score.structure,
      hypothesis_score: normalized.score.hypothesis,
      insight_score: normalized.score.insight,
      practicality_score: normalized.score.practicality,
      communication_score: normalized.score.communication,

      ai_feedback: normalized.feedback,
    };

    // ✅ A: RLSでinsert（ポリシー必要）
    let insertRes = await supabase
      .from("case_logs")
      .insert(insertPayload)
      .select("id")
      .single();

    // ✅ B: 保険（RLSがまだ/壊れてる時だけ）
    if (insertRes.error) {
      console.error("case_logs insert error (authed):", insertRes.error);
      insertRes = await supabaseAdmin
        .from("case_logs")
        .insert(insertPayload)
        .select("id")
        .single();

      if (insertRes.error) {
        console.error("case_logs insert error (admin):", insertRes.error);
      }
    }

    return NextResponse.json({
      ok: true,
      plan,
      remaining: typeof usageJson?.remaining === "number" ? usageJson.remaining : null,
      usedCount: typeof usageJson?.usedCount === "number" ? usageJson.usedCount : null,
      limit: typeof usageJson?.limit === "number" ? usageJson.limit : null,
      ...normalized,
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
