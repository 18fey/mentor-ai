// app/api/ai-training/eval/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireFeatureOrConsumeMeta } from "@/lib/payment/featureGate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// =====================
// Types
// =====================
type ScenarioKey = "consulting" | "finance" | "bizdev" | "backoffice" | "student";
type ModifierGrade = "A" | "B" | "C";
type AiTypeKey = "sensory" | "overSpec" | "logical" | "dependent" | "strategic";

type Step = 1 | 2 | 3 | 4 | 5;

type LegacyScores = {
  clarity: number; // 1-5
  structure: number; // 1-5
  reproducibility: number; // 1-5
  strategy: number; // 1-5
};

type Core10 = {
  goal_framing: number; // 0-10
  constraint_design: number; // 0-10
  structuring: number; // 0-10
  evaluation: number; // 0-10
  refinement: number; // 0-10
  output_quality: number; // 0-10
};

type Modifiers = {
  compliance: ModifierGrade;
  efficiency: ModifierGrade;
};

type LegacyBody = {
  scenario: ScenarioKey;
  answers: Record<number, string>;
  promptText?: string;
  dialog?: Array<{ role: "user" | "assistant"; content: string }>;
  finalOutput?: string;
  durationSec?: number;
  version?: string;
};

type NewUiBody = {
  scenario_key: ScenarioKey;
  user_prompt: string;
  dialogue_log: string;
  final_output: string;
  optional_notes?: string;
  time_spent_sec?: number;
  turn_count?: number;
};

// UI が期待してる返却形式
type AcsScores0to9 = {
  goal_framing: number; // 0.0-9.0
  constraint_design: number;
  structuring: number;
  evaluation: number;
  iterative_refinement: number;
  final_output_quality: number;
  base_acs: number;
  final_acs: number;
};

type AcsResult = {
  scenario_key: ScenarioKey;
  scores: AcsScores0to9;
  modifiers: Modifiers;
  evidence: { positive: string[]; risk: string[] };
  diagnosis: {
    one_liner: string;
    top_strengths: string[];
    top_gaps: string[];
    next_actions: string[];
  };
  flags: {
    pii_or_secret_risk: boolean;
    hallucination_risk: boolean;
    overdelegation_risk: boolean;
  };
};

const FEATURE_ID = "ai_training" as const;

// =====================
// Helpers
// =====================
function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

function to0to9(from0to10: number) {
  // 10点満点 → 9点満点へ縮尺
  return round1(clamp((from0to10 / 10) * 9, 0, 9));
}

function gradeFromTurnsOrLength(turns: number, totalLen: number): ModifierGrade {
  // turnsが取れればそっち優先
  if (turns > 0) {
    if (turns <= 6) return "A";
    if (turns <= 10) return "B";
    return "C";
  }
  if (totalLen < 900) return "A";
  if (totalLen < 1600) return "B";
  return "C";
}

function applyModifiers(base: number, m: Modifiers) {
  // ざっくり補正（必要なら後で調整）
  // Compliance: A +0.2 / B +0.0 / C -0.3
  const comp =
    m.compliance === "A" ? 0.2 : m.compliance === "B" ? 0.0 : -0.3;

  // Efficiency: A +0.1 / B +0.0 / C -0.2
  const eff =
    m.efficiency === "A" ? 0.1 : m.efficiency === "B" ? 0.0 : -0.2;

  return round1(clamp(base + comp + eff, 0, 9));
}

function makeSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

// =====================
// Scoring (heuristic v1)
// =====================
function evaluateLegacy(answers: Record<number, string>): LegacyScores {
  const a1 = answers[1] ?? "";
  const a2 = answers[2] ?? "";
  const a3 = answers[3] ?? "";
  const a4 = answers[4] ?? "";

  const len1 = a1.length;
  const len2 = a2.length;
  const len4 = a4.length;

  let clarity = 1;
  const hasTargetWords = /(ターゲット|対象|誰に|相手|顧客)/.test(a1 + a2);
  const hasToneWords = /(トーン|雰囲気|カジュアル|丁寧|フォーマル)/.test(a1 + a2);
  const hasLengthWords = /(文字|字|分量|ページ)/.test(a1 + a2);
  const hasPurposeWords = /(目的|ゴール|狙い|KPI|成果)/.test(a1 + a2);

  const richness =
    (hasTargetWords ? 1 : 0) +
    (hasToneWords ? 1 : 0) +
    (hasLengthWords ? 1 : 0) +
    (hasPurposeWords ? 1 : 0);

  if (len1 + len2 < 40) clarity = 1;
  else if (len1 + len2 < 120) clarity = 2;
  else if (richness <= 1) clarity = 3;
  else if (richness === 2 || richness === 3) clarity = 4;
  else clarity = 5;

  const lines3 = a3.split(/\n/).filter((l) => l.trim().length > 0).length;
  let structure = 1;
  if (lines3 >= 2) structure = 2;
  if (lines3 >= 3) structure = 3;
  if (lines3 >= 5) structure = 4;
  if (lines3 >= 7) structure = 5;

  let reproducibility = 1;
  const keyCount = richness;
  if (keyCount === 0) reproducibility = 1;
  else if (keyCount === 1) reproducibility = 2;
  else if (keyCount === 2) reproducibility = 3;
  else if (keyCount === 3) reproducibility = 4;
  else reproducibility = 5;

  let strategy = 1;
  const hasSplit =
    /AIに任せ|人間|自分が|役割分担/.test(a4) || /(①|②|③|④)/.test(a4);
  const mentionsReason = /(理由|から|ため)/.test(a4);

  if (len4 < 20) strategy = 1;
  else if (!hasSplit) strategy = 2;
  else if (hasSplit && !mentionsReason) strategy = 3;
  else if (hasSplit && mentionsReason && len4 > 80) strategy = 4;
  else strategy = 5;

  return { clarity, structure, reproducibility, strategy };
}

function detectAiType(answers: Record<number, string>, legacy: LegacyScores): AiTypeKey {
  const a1 = answers[1] ?? "";
  const a2 = answers[2] ?? "";
  const a3 = answers[3] ?? "";
  const a4 = answers[4] ?? "";

  const totalPromptLen = (a1 + a2).length;
  const saysAllToAi = /全部AI|丸投げ|とりあえずAI/.test(a4 + a1 + a2);
  const hasManyConditions = totalPromptLen > 400 && /(条件|ただし|なお|※)/.test(a1 + a2);
  const quiteStructured = legacy.structure >= 4 && /(・|-|①|②)/.test(a3);
  const mentionsSplit = /(AIに任せ|人間|自分が|役割分担)/.test(a4);

  if (saysAllToAi) return "dependent";
  if (mentionsSplit && legacy.strategy >= 4) return "strategic";
  if (hasManyConditions && legacy.clarity >= 3) return "overSpec";
  if (quiteStructured && legacy.structure >= 4) return "logical";
  return "sensory";
}

function scoreCore10(answers: Record<number, string>, legacy: LegacyScores): Core10 {
  const a4 = answers[4] ?? "";
  const a5 = answers[5] ?? "";

  const goal_framing = Math.min(10, legacy.clarity * 2);
  const constraint_design = Math.min(10, legacy.reproducibility * 2);
  const structuring = Math.min(10, legacy.structure * 2);

  const evaluation = Math.min(
    10,
    (/(根拠|前提|検証|リスク|注意)/.test(a4 + a5) ? 7 : 4) + (a5.length > 120 ? 2 : 0)
  );

  const refinement = Math.min(
    10,
    (/(修正|改善|差し替え|具体化)/.test(a5) ? 7 : 4) + (a5.length > 120 ? 2 : 0)
  );

  const output_quality = Math.min(
    10,
    (a5.length > 80 ? 6 : 4) + (/(結論|要点|箇条書き)/.test(a5) ? 2 : 0)
  );

  return { goal_framing, constraint_design, structuring, evaluation, refinement, output_quality };
}

function scoreModifiers(body: LegacyBody): Modifiers {
  const text =
    JSON.stringify(body.answers) +
    " " +
    (body.finalOutput ?? "") +
    " " +
    (body.promptText ?? "");

  const compliance: ModifierGrade =
    /(社外秘|個人情報|機密|守秘|NDA|断定しない|仮説|前提|注意書き|免責)/.test(text)
      ? "A"
      : /(注意|前提|仮)/.test(text)
      ? "B"
      : "C";

  const turns = body.dialog?.length ?? 0;
  const totalLen = Object.values(body.answers ?? {}).join("\n").length;
  const efficiency: ModifierGrade = gradeFromTurnsOrLength(turns, totalLen);

  return { compliance, efficiency };
}

// =====================
// Body normalization (旧/新両対応)
// =====================
function normalizeBody(raw: any): LegacyBody | null {
  // 旧形式
  if (raw?.scenario && raw?.answers) {
    return raw as LegacyBody;
  }

  // 新UI形式
  if (raw?.scenario_key && raw?.user_prompt != null) {
    const b = raw as NewUiBody;

    // 新UIは step が 3つなので、heuristic用に 4/5 を補う
    return {
      scenario: b.scenario_key,
      answers: {
        1: b.user_prompt ?? "",
        2: b.dialogue_log ?? "",
        3: b.final_output ?? "",
        4: b.optional_notes ?? "",
        5: b.final_output ?? "", // v1: 最終成果物を “改善後” とみなして流用
      },
      promptText: b.user_prompt ?? "",
      finalOutput: b.final_output ?? "",
      durationSec: b.time_spent_sec ?? undefined,
      version: "v1-ui",
      // dialog_json を入れたいなら、ここで dialogue_log を分解してもOK（今はnullでOK）
    };
  }

  return null;
}

// =====================
// Evidence / diagnosis / flags (simple)
// =====================
function buildFlags(text: string, aiType: AiTypeKey) {
  const pii_or_secret_risk = /(住所|電話|メール|口座|顧客名|社外秘|機密|NDA)/.test(text);
  const hallucination_risk = /(断定|必ず|確実|絶対)/.test(text) && /(出典|参照|ソース)/.test(text) === false;
  const overdelegation_risk = aiType === "dependent" || /(丸投げ|全部AI)/.test(text);

  return { pii_or_secret_risk, hallucination_risk, overdelegation_risk };
}

function buildEvidence(legacy: LegacyScores, core10: Core10, modifiers: Modifiers) {
  const positive: string[] = [];
  const risk: string[] = [];

  if (core10.goal_framing >= 7) positive.push("目的・成果物の指定が明確で、AIが迷いにくい。");
  if (core10.constraint_design >= 7) positive.push("制約（安全/範囲/前提）の設計があり、再現性が高い。");
  if (core10.structuring >= 7) positive.push("構造化（箇条書き/テンプレ）で収束しやすい。");

  if (modifiers.compliance === "C") risk.push("前提・注意書きが薄く、断定や漏洩リスクが上がりやすい。");
  if (modifiers.efficiency === "C") risk.push("往復が増えやすい書き方。最初の制約と出力形式を固定すると良い。");
  if (core10.output_quality <= 4) risk.push("最終成果物の“そのまま使える度”が弱い（結論/要点/次アクション不足）。");

  return { positive: positive.slice(0, 5), risk: risk.slice(0, 5) };
}

function buildDiagnosis(scores0to9: AcsScores0to9, aiType: AiTypeKey) {
  const strengths: string[] = [];
  const gaps: string[] = [];
  const next: string[] = [];

  if (scores0to9.goal_framing >= 7.0) strengths.push("ゴール定義が先に立つ（AIが迷わない）");
  else gaps.push("ゴール/成果物の指定を先に固定する");

  if (scores0to9.constraint_design >= 7.0) strengths.push("制約条件で事故を抑える設計ができる");
  else gaps.push("禁止/OK/前提/出力制約を1行で足す");

  if (scores0to9.structuring >= 7.0) strengths.push("構造化して収束させられる");
  else gaps.push("テンプレ・見出し・箇条書きを先に指定する");

  if (scores0to9.iterative_refinement >= 7.0) strengths.push("修正指示で質を上げられる");
  else gaps.push("修正は“差分指示（ここをこう）”で短く行う");

  next.push("最初のプロンプトに「前提/禁止/出力テンプレ」を必ずセットで入れる");
  next.push("1回目のAI出力に対して「不足3点→差分修正」で2往復以内に収束させる");
  next.push("最終成果物に「リスク/前提/チェック観点」を1文だけ足してComplianceを上げる");

  const one_liner =
    aiType === "dependent"
      ? "AIに寄せすぎの傾向。役割分担とチェック観点を固定すると一気に伸びる。"
      : aiType === "overSpec"
      ? "条件過多で収束が遅くなりがち。出力テンプレ固定で短縮できる。"
      : aiType === "logical"
      ? "構造化が強み。最後の安全/前提の一文で完成度が上がる。"
      : aiType === "strategic"
      ? "役割分担が上手い。再現性をテンプレ化すると武器になる。"
      : "感覚的に進めがち。目的・制約・テンプレの3点セットで安定する。";

  return {
    one_liner,
    top_strengths: strengths.slice(0, 3),
    top_gaps: gaps.slice(0, 3),
    next_actions: next.slice(0, 3),
  };
}

// =====================
// Handler
// =====================
export async function POST(req: Request) {
  try {
    // ✅ feature gate + consume meta if needed
    const gate = await requireFeatureOrConsumeMeta(FEATURE_ID as any);
    if (!gate.ok) {
      return NextResponse.json(
        { ok: false, reason: gate.reason, required: gate.required ?? undefined },
        { status: gate.status }
      );
    }

    const raw = await req.json().catch(() => ({}));
    const body = normalizeBody(raw);

    if (!body?.scenario || !body?.answers) {
      return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
    }

    // score
    const legacy = evaluateLegacy(body.answers);
    const aiType = detectAiType(body.answers, legacy);
    const core10 = scoreCore10(body.answers, legacy);
    const modifiers = scoreModifiers(body);

    // to UI scores (0-9)
    const scores0to9: AcsScores0to9 = {
      goal_framing: to0to9(core10.goal_framing),
      constraint_design: to0to9(core10.constraint_design),
      structuring: to0to9(core10.structuring),
      evaluation: to0to9(core10.evaluation),
      iterative_refinement: to0to9(core10.refinement),
      final_output_quality: to0to9(core10.output_quality),
      base_acs: 0,
      final_acs: 0,
    };

    const base =
      (scores0to9.goal_framing +
        scores0to9.constraint_design +
        scores0to9.structuring +
        scores0to9.evaluation +
        scores0to9.iterative_refinement +
        scores0to9.final_output_quality) /
      6;

    scores0to9.base_acs = round1(clamp(base, 0, 9));
    scores0to9.final_acs = applyModifiers(scores0to9.base_acs, modifiers);

    const allText =
      Object.values(body.answers).join("\n") +
      " " +
      (body.promptText ?? "") +
      " " +
      (body.finalOutput ?? "");

    const flags = buildFlags(allText, aiType);
    const evidence = buildEvidence(legacy, core10, modifiers);
    const diagnosis = buildDiagnosis(scores0to9, aiType);

    const result: AcsResult = {
      scenario_key: body.scenario,
      scores: scores0to9,
      modifiers,
      evidence,
      diagnosis,
      flags,
    };

    // store attempt
    const supabase = makeSupabaseAdmin();
    const authUserId = gate.authUserId;

    const insertPayload = {
      auth_user_id: authUserId,
      scenario: body.scenario,
      version: body.version ?? "v1",
      duration_sec: body.durationSec ?? null,
      prompt_text: body.promptText ?? null,
      dialog_json: body.dialog ?? null,
      final_output: body.finalOutput ?? null,
      user_notes: body.answers?.[4] ?? null,
      scores_json: {
        legacy,
        core10,
        scores0to9,
      },
      modifiers_json: modifiers,
      ai_type: aiType,
      eval_method: "heuristic",
      eval_model: null,
      eval_trace: null,
    };

    const { error: dbErr } = await supabase.from("acs_attempts").insert(insertPayload);
    if (dbErr) {
      // DB失敗してもUIは返したい（体験優先）
      console.error("acs_attempts insert error:", dbErr);
    }

    return NextResponse.json(result, { status: 200 });
  } catch (e: any) {
    console.error("ai-training eval error:", e);
    return NextResponse.json({ ok: false, error: "SERVER_ERROR" }, { status: 500 });
  }
}
