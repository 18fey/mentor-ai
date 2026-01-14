// app/api/eval/case/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL_EVAL = process.env.OPENAI_MODEL_EVAL_CASE || "gpt-4.1-mini";

// service role（Route内だけ）
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type Database = any;

type CaseDomain = "consulting" | "general" | "trading" | "ib";
type CasePattern = "market_sizing" | "profitability" | "entry" | "new_business" | "operation";

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

type CaseScore = {
  structure: number;
  hypothesis: number;
  insight: number;
  practicality: number;
  communication: number;
};

type CaseFeedback = {
  summary: string;
  goodPoints: string;
  improvePoints: string;
  nextTraining: string;
};

// ✅ 追加：模範解答（UIでそのまま見せられる粒度）
type CaseModelAnswer = {
  goal: string;
  kpi: string; // KPI候補（箇条書きOK）
  framework: string; // 分解（式・ツリー・観点）
  hypothesis: string; // 初手仮説
  deepDivePlan: string; // 深掘りの順序（1-5）
  analysis: string; // 置く数字・計算例・感度
  solutions: string; // 打ち手（優先順位）
  risks: string; // 前提/リスク
  wrapUp: string; // 30秒クロージング
};

type CaseEvalResult = {
  score: CaseScore;
  feedback: CaseFeedback;
  totalScore: number;
  logId: string | number | null; // case_logs の id

  // ✅ 追加（後方互換：UIが知らなくても壊れない）
  modelAnswer?: CaseModelAnswer;
};

type FeatureId = "case_interview";

function safeStr(v: unknown, maxLen: number) {
  if (typeof v !== "string") return "";
  return v.slice(0, maxLen);
}

function clamp0to10(n: any) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(10, Math.round(x)));
}

function rid() {
  return Math.random().toString(36).slice(2, 10);
}

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

// ✅ adminで残高を正として取る（meta_lotsのremaining合計）
async function getBalanceAdmin(authUserId: string): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from("meta_lots")
    .select("remaining")
    .eq("auth_user_id", authUserId)
    .gt("remaining", 0);

  if (error) {
    console.error("getBalanceAdmin error:", error);
    return 0;
  }

  let sum = 0;
  for (const row of data ?? []) sum += Number((row as any).remaining ?? 0);
  return Number.isFinite(sum) ? sum : 0;
}

// ✅ 追加：模範解答の正規化（長すぎ・null対策）
function normalizeModelAnswer(v: any): CaseModelAnswer | null {
  if (!v || typeof v !== "object") return null;

  const out: CaseModelAnswer = {
    goal: safeStr(v.goal ?? "", 1200),
    kpi: safeStr(v.kpi ?? "", 1600),
    framework: safeStr(v.framework ?? "", 2400),
    hypothesis: safeStr(v.hypothesis ?? "", 1200),
    deepDivePlan: safeStr(v.deepDivePlan ?? "", 2000),
    analysis: safeStr(v.analysis ?? "", 2400),
    solutions: safeStr(v.solutions ?? "", 2000),
    risks: safeStr(v.risks ?? "", 1200),
    wrapUp: safeStr(v.wrapUp ?? "", 1400),
  };

  // ほぼ空なら返さない
  const totalLen =
    out.goal.length +
    out.kpi.length +
    out.framework.length +
    out.hypothesis.length +
    out.deepDivePlan.length +
    out.analysis.length +
    out.solutions.length +
    out.risks.length +
    out.wrapUp.length;

  if (totalLen < 40) return null;
  return out;
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

    // ✅ auth
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

    // ✅ meta confirm（confirm 後だけ true）
    const metaConfirm =
      req.headers.get("x-meta-confirm") === "1" ||
      req.headers.get("X-Meta-Confirm") === "1";

    // ✅ 入力
    const body = (await req.json().catch(() => ({}))) as {
      case: CaseQuestion;
      answers: Answers;
    };

    const caseQ = body?.case;
    const answers = body?.answers;

    if (!caseQ || !answers) {
      return NextResponse.json(
        { ok: false, error: "bad_request", message: "case/answers is required" },
        { status: 400 }
      );
    }

    const feature: FeatureId = "case_interview";

    // =========================
    // ✅ 0) generation_jobs lookup (idempotent)
    // =========================
    const { data: existing, error: exErr } = await supabase
      .from("generation_jobs")
      .select("id, status, result")
      .eq("auth_user_id", authUserId)
      .eq("feature_id", feature)
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

    if (exErr) {
      console.error(`[case:${requestId}] job lookup error`, exErr);
      return NextResponse.json({ ok: false, error: "db_error" }, { status: 500 });
    }

    if (existing?.status === "succeeded" && existing?.result) {
      return NextResponse.json({ ok: true, ...existing.result, reused: true });
    }

    // =========================
    // ✅ 0.5) generation_jobs upsert running
    // =========================
    const jobRequest = {
      case: {
        id: safeStr(caseQ.id, 80),
        domain: safeStr(caseQ.domain, 30),
        pattern: safeStr(caseQ.pattern, 30),
        title: safeStr(caseQ.title, 160),
        client: safeStr(caseQ.client, 120),
        prompt: safeStr(caseQ.prompt, 4000),
        hint: safeStr(caseQ.hint, 1200),
        kpiExamples: safeStr(caseQ.kpiExamples, 1200),
      },
      answers: {
        goal: safeStr(answers.goal, 2000),
        kpi: safeStr(answers.kpi, 2000),
        framework: safeStr(answers.framework, 4000),
        hypothesis: safeStr(answers.hypothesis, 2000),
        deepDivePlan: safeStr(answers.deepDivePlan, 4000),
        analysis: safeStr(answers.analysis, 6000),
        solutions: safeStr(answers.solutions, 4000),
        risks: safeStr(answers.risks, 2000),
        wrapUp: safeStr(answers.wrapUp, 2000),
      },
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
      .select("id")
      .single();

    if (upErr || !upserted?.id) {
      console.error(`[case:${requestId}] job upsert error`, upErr);
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
      body: JSON.stringify({ feature }),
    });

    const checkBody: any = await checkRes.json().catch(() => ({}));

    const requiredMetaFromCheck = Number(checkBody?.requiredMeta ?? checkBody?.required ?? 1);

    let proceedMode: "unlimited" | "free" | "need_meta" =
      checkBody?.mode ?? (metaConfirm ? "need_meta" : "free");
    let requiredMeta = Number(checkBody?.requiredMeta ?? 1);

    if (!checkRes.ok) {
      if (checkRes.status === 402 && checkBody?.error === "need_meta") {
        requiredMeta = requiredMetaFromCheck;
        proceedMode = "need_meta";

        if (!metaConfirm) {
          await supabase
            .from("generation_jobs")
            .update({
              status: "failed",
              error_code: "need_meta",
              error_message: `INSUFFICIENT_META required=${requiredMeta}`,
              updated_at: new Date().toISOString(),
            })
            .eq("id", jobId);

          return NextResponse.json(
            { ok: false, error: "need_meta", requiredMeta },
            { status: 402 }
          );
        }

        const bal = await getBalanceAdmin(authUserId);
        if (bal < requiredMeta) {
          await supabase
            .from("generation_jobs")
            .update({
              status: "failed",
              error_code: "need_meta",
              error_message: `INSUFFICIENT_META_AFTER_CONFIRM required=${requiredMeta} balance=${bal}`,
              updated_at: new Date().toISOString(),
            })
            .eq("id", jobId);

          return NextResponse.json(
            { ok: false, error: "need_meta", requiredMeta, balance: bal },
            { status: 402 }
          );
        }
      } else if (checkRes.status === 401) {
        return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
      } else {
        console.error(`[case:${requestId}] usage/check unexpected`, checkRes.status, checkBody);
        return NextResponse.json({ ok: false, error: "usage_error" }, { status: 500 });
      }
    } else {
      proceedMode = checkBody?.mode ?? "free";
      requiredMeta = Number(checkBody?.requiredMeta ?? 1);

      if (proceedMode === "need_meta" && !metaConfirm) {
        return NextResponse.json(
          { ok: false, error: "need_meta", requiredMeta },
          { status: 402 }
        );
      }

      if (proceedMode === "need_meta" && metaConfirm) {
        const bal = await getBalanceAdmin(authUserId);
        if (bal < requiredMeta) {
          return NextResponse.json(
            { ok: false, error: "need_meta", requiredMeta, balance: bal },
            { status: 402 }
          );
        }
      }
    }

    // =========================
    // ✅ 2) OpenAI（必ずJSON）※ modelAnswer を追加
    // =========================
    const systemPrompt = `
あなたはケース面接官。日本語で、辛口だが建設的。
出力は必ず JSON 形式のみ。前後に説明文は書かない。
スコアは0〜10の整数。
フィードバックは具体例・理由つきで短く鋭く。

加えて、同じケースに対する「模範解答（modelAnswer）」を、初心者でも真似できる粒度で作ること。
ただし長文にしすぎない（各フィールドは最大10行程度）。
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
  },
  "modelAnswer": {
    "goal": "ゴール定義（1〜3行）",
    "kpi": "KPI候補（箇条書き）",
    "framework": "分解の仕方（式/ツリー/観点。箇条書きOK）",
    "hypothesis": "初手仮説（1〜3行）",
    "deepDivePlan": "深掘り手順（1〜5）",
    "analysis": "置く数字・計算例・感度の当て方（箇条書きOK）",
    "solutions": "打ち手（優先順位つきで最大3つ）",
    "risks": "前提/リスク（最大5つ）",
    "wrapUp": "30秒クロージング（結論→理由→次アクション）"
  }
}
`.trim();

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL_EVAL,
        response_format: { type: "json_object" },
        temperature: 0.3,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!r.ok) {
      const errText = await r.text().catch(() => "");
      console.error(`[case:${requestId}] openai error`, errText);

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

    const sc = parsed?.score ?? {};
    const fb = parsed?.feedback ?? {};
    const ma = parsed?.modelAnswer ?? null;

    const normalizedScore: CaseScore = {
      structure: clamp0to10(sc.structure),
      hypothesis: clamp0to10(sc.hypothesis),
      insight: clamp0to10(sc.insight),
      practicality: clamp0to10(sc.practicality),
      communication: clamp0to10(sc.communication),
    };

    const normalizedFeedback: CaseFeedback = {
      summary: safeStr(String(fb.summary ?? ""), 1200),
      goodPoints: safeStr(String(fb.goodPoints ?? ""), 2000),
      improvePoints: safeStr(String(fb.improvePoints ?? ""), 2400),
      nextTraining: safeStr(String(fb.nextTraining ?? ""), 1600),
    };

    const normalizedModelAnswer = normalizeModelAnswer(ma);

    const totalScore =
      normalizedScore.structure +
      normalizedScore.hypothesis +
      normalizedScore.insight +
      normalizedScore.practicality +
      normalizedScore.communication;

    // =========================
    // ✅ 3) case_logs insert（任意）
    // =========================
    let logId: string | number | null = null;

    try {
      const aiFeedbackPayload: any = {
        ...normalizedFeedback,
        // ✅ DB schema増やさずにJSONへ同居
        ...(normalizedModelAnswer ? { modelAnswer: normalizedModelAnswer } : {}),
      };

      const insertPayload: any = {
        user_id: authUserId,
        problem_id: caseQ.id ?? null,
        domain: caseQ.domain ?? null,
        pattern: caseQ.pattern ?? null,

        problem: caseQ,
        answer: answers,
        ai_feedback: aiFeedbackPayload,
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

        structure_score: normalizedScore.structure,
        hypothesis_score: normalizedScore.hypothesis,
        insight_score: normalizedScore.insight,
        practicality_score: normalizedScore.practicality,
        communication_score: normalizedScore.communication,

        job_id: jobId,
        idempotency_key: idempotencyKey,
      };

      const ins = await supabase.from("case_logs").insert(insertPayload).select("id").single();
      if (ins.data?.id) logId = ins.data.id;

      if (ins.error) {
        const ins2 = await supabaseAdmin
          .from("case_logs")
          .insert(insertPayload)
          .select("id")
          .single();
        if (ins2.data?.id) logId = ins2.data.id;
      }
    } catch (e) {
      console.error(`[case:${requestId}] case_logs insert failed`, e);
    }

    // =========================
    // ✅ 4) generation_jobs result保存
    // =========================
    const result: CaseEvalResult = {
      score: normalizedScore,
      feedback: normalizedFeedback,
      totalScore,
      logId,
      ...(normalizedModelAnswer ? { modelAnswer: normalizedModelAnswer } : {}),
    };

    const { error: saveErr } = await supabase
      .from("generation_jobs")
      .update({
        status: "succeeded",
        result,
        updated_at: new Date().toISOString(),
        log_id: logId ? String(logId) : null,
      })
      .eq("id", jobId);

    if (saveErr) {
      console.error(`[case:${requestId}] result save failed`, saveErr);
      return NextResponse.json({ ok: false, error: "result_save_failed" }, { status: 500 });
    }

    // =========================
    // ✅ 5) 成功後だけ課金
    // =========================
    if (proceedMode === "free") {
      await fetch(`${baseUrl}/api/usage/log`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookieHeader },
        body: JSON.stringify({ feature, jobId }),
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
            log_id: `meta_charge_failed:${String(consumeErr.message ?? "").slice(0, 200)}`,
            updated_at: new Date().toISOString(),
          })
          .eq("id", jobId);
      }
    }

    return NextResponse.json({
      ok: true,
      ...result,
      jobId,
      idempotencyKey,
    });
  } catch (e: any) {
    console.error("Case Eval API error:", e);
    return NextResponse.json(
      { ok: false, error: "server_error", message: "ケース評価に失敗しました" },
      { status: 500 }
    );
  }
}
