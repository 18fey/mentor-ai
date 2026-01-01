"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

// =====================================================
// Mentor.AI — ACS (AI Collaboration Score) 30min Edition
// Client-only UI: gather inputs → POST /api/ai-training/eval→ show JSON-based result
// =====================================================

// -------------------- Types --------------------
type ScenarioKey =
  | "consulting"
  | "finance"
  | "bizdev"
  | "backoffice"
  | "student";

type Step = 1 | 2 | 3;

type ModifierGrade = "A" | "B" | "C";

type AcsScores = {
  goal_framing: number; // 0.0 - 9.0
  constraint_design: number;
  structuring: number;
  evaluation: number;
  iterative_refinement: number;
  final_output_quality: number;
  base_acs: number; // avg
  final_acs: number; // after modifiers caps/bonus
};

type AcsResult = {
  scenario_key: string;
  scores: AcsScores;
  modifiers: { compliance: ModifierGrade; efficiency: ModifierGrade };
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

type DialogueTurn = {
  role: "user" | "ai";
  content: string;
};

type Scenario = {
  key: ScenarioKey;
  label: string;
  // What the test is about (shown to user)
  briefing: {
    role: string;
    situation: string;
    constraints: string[];
    goal: string;
    deliverableRules: string[];
  };
  // The exact task prompt we send to evaluator
  task_prompt: string;
  // Output template hint for the final output
  finalOutputTemplate: string;
};

// -------------------- Scenarios --------------------
const SCENARIOS: Scenario[] = [
  {
    key: "consulting",
    label: "コンサル（導入/PoC設計）",
    briefing: {
      role: "コンサルティングファームの若手",
      situation:
        "クライアント（中堅企業）から「AIを使えと言われているが、漏洩や誤情報が怖くて進まない。まず何から始めるべきか？」と相談された。",
      constraints: [
        "社内データは外部に出せない",
        "IT部門は忙しく専任が置けない",
        "3ヶ月以内に“効果が見える”必要がある",
      ],
      goal:
        "来週の社内会議でそのまま使える「AI導入の最初の一手」を1つ完成させる（完璧な計画より、安全・現実・実行可能が最優先）。",
      deliverableRules: [
        "最終成果物は200〜300字",
        "施策名 / AIに任せる範囲 / 人が判断する範囲 / なぜ安全&実行可能か を含める",
        "断定を避け、前提・注意点を入れると安全",
      ],
    },
    task_prompt: `【シナリオ】
あなたはコンサルティングファームの若手です。クライアント（中堅企業）から次の相談を受けています。
「社内でAIを使えと言われているが、情報漏洩や誤情報が怖くて進まない。まず何から始めるべきかを知りたい。」

【制約条件（重要）】
- 社内データは外部に出せない
- IT部門は忙しく、専任は置けない
- 3ヶ月以内に“効果が見える”必要がある

【ゴール】
来週の社内会議でそのまま使える「AI導入の最初の一手」を1つ完成させる。
※完璧な計画でなくていい
※安全・現実・実行可能が最優先`,
    finalOutputTemplate:
      "施策名：\nAIに任せる：\n人が判断する：\n安全・実行可能な理由：",
  },

  {
    key: "finance",
    label: "金融（リサーチ/メモ作成）",
    briefing: {
      role: "証券/運用の若手アナリスト",
      situation:
        "上司から「クライアント向けに“今週の注目テーマ”を作って」と言われた。外部公開情報での作成が前提。",
      constraints: [
        "未公開情報・顧客情報・社内メモなどは外部に出せない",
        "事実の断定や投資助言になりすぎない配慮が必要",
        "30分で“そのまま送れる下書き”を作る",
      ],
      goal:
        "クライアント向けの短いメモ（論点/リスク/次のアクション）を完成させる。AIをどう使い、どこを人がチェックするかも示す。",
      deliverableRules: [
        "最終成果物は200〜300字",
        "リスク/前提/確認ポイントを1つ以上入れる",
        "投資助言の断定表現を避ける",
      ],
    },
    task_prompt: `【シナリオ】
あなたは証券/運用の若手アナリストです。上司から「クライアント向けに“今週の注目テーマ”メモを作って」と依頼されました。外部公開情報ベースで作成し、未公開情報・顧客情報・社内情報は扱えません。

【制約条件（重要）】
- 投資助言の断定になりすぎない配慮が必要
- 誤情報や断定のリスクがあるため、人が最終チェックする前提で進める
- 30分で“そのまま送れる下書き”を作る

【ゴール】
クライアント向けの短いメモ（論点/リスク/次アクション）を完成させ、AIに任せる範囲と人が判断する範囲を示す。`,
    finalOutputTemplate:
      "テーマ：\n要点：\nリスク/前提：\n次アクション：\nAI/人の役割：",
  },

  {
    key: "bizdev",
    label: "事業開発（仮説→実行案）",
    briefing: {
      role: "スタートアップのBizDev",
      situation:
        "新規施策の売上が伸びない。原因仮説を立て、次の1週間でやる打ち手を決めたい。",
      constraints: [
        "データはざっくり（数値は仮置きでOK）",
        "短時間で収束することが重要",
        "AIに任せすぎず、意思決定は人がする",
      ],
      goal:
        "“1週間の実験プラン”を1つ作る（仮説→打ち手→成功指標→次の分岐）。",
      deliverableRules: [
        "最終成果物は200〜300字",
        "仮説と成功指標（KPI）を必ず入れる",
        "AIの出力の前提を明示する",
      ],
    },
    task_prompt: `【シナリオ】
あなたはスタートアップのBizDevです。新規施策の売上が伸びません。短時間で原因仮説を立て、次の1週間で実行する打ち手を決める必要があります。

【制約条件（重要）】
- データはざっくりでOK（数値は仮置き可）
- 短時間で収束することが重要
- AIに任せすぎず、意思決定は人が行う

【ゴール】
「1週間の実験プラン」を1つ完成させる（仮説→打ち手→成功指標→次の分岐）。`,
    finalOutputTemplate:
      "仮説：\n打ち手：\n成功指標(KPI)：\n次の分岐：\nAI/人の役割：",
  },

  {
    key: "backoffice",
    label: "バックオフィス（社内運用/規程）",
    briefing: {
      role: "総務/人事/情シスの担当",
      situation:
        "AI利用ルールを作りたいが、現場が回る形で“最初の一歩”だけ決めたい。",
      constraints: [
        "厳しすぎると運用されない",
        "ゆるすぎると事故る",
        "まずは3ヶ月の暫定運用でOK",
      ],
      goal:
        "3ヶ月の暫定運用として“最初の一手”を、誰が見ても実行できる形で作る。",
      deliverableRules: [
        "最終成果物は200〜300字",
        "禁止事項/OK例を最低1つずつ入れると強い",
        "責任分界（誰が承認するか）を入れると強い",
      ],
    },
    task_prompt: `【シナリオ】
あなたは総務/人事/情シスの担当です。社内でAI利用を推進したい一方、事故（漏洩/誤情報/権利）も避けたい。現場が回る形で、まずは3ヶ月の暫定運用ルールを作る必要があります。

【制約条件（重要）】
- 厳しすぎると運用されない
- ゆるすぎると事故る
- まずは3ヶ月の暫定運用でOK

【ゴール】
3ヶ月の暫定運用として“最初の一手”を、誰が見ても実行できる形で作る。`,
    finalOutputTemplate:
      "暫定ルール名：\nOK：\nNG：\n承認/責任：\n安全な理由：",
  },

  {
    key: "student",
    label: "学生（ES/レポ/面接準備）",
    briefing: {
      role: "就活中の大学生",
      situation:
        "ESや面接が通らない。AIを使って改善したいが、丸投げではなく“自分の軸”を残したい。",
      constraints: [
        "虚偽にならない（事実と解釈を分ける）",
        "企業名や数字を盛りすぎない",
        "30分で改善版の骨子を作る",
      ],
      goal:
        "ES/面接の骨子を“自分の言葉”で作り、AIの使い方とチェック観点も示す。",
      deliverableRules: [
        "最終成果物は200〜300字",
        "事実/学び/再現性の3点を入れる",
        "盛りすぎ防止の注意点を1つ入れる",
      ],
    },
    task_prompt: `【シナリオ】
あなたは就活中の大学生です。ESや面接が通りません。AIを使って改善したいが、丸投げではなく“自分の軸”を残したい。

【制約条件（重要）】
- 虚偽にならない（事実と解釈を分ける）
- 企業名や数字を盛りすぎない
- 30分で改善版の骨子を作る

【ゴール】
ES/面接の骨子を“自分の言葉”で作り、AIの使い方とチェック観点も示す。`,
    finalOutputTemplate:
      "核となるエピソード：\n事実：\n学び：\n再現性：\nAI/人のチェック：",
  },
];

// -------------------- Utils --------------------
function clampText(s: string, max = 4000) {
  const t = (s ?? "").trim();
  if (t.length <= max) return t;
  return t.slice(0, max) + "…";
}

function toOneDecimal(n: any) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.round(x * 10) / 10;
}

function gradeBadge(grade: ModifierGrade) {
  if (grade === "A") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (grade === "B") return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-rose-50 text-rose-700 border-rose-200";
}

function scoreColor(value0to9: number) {
  // no custom colors—using neutral tailwind classes only
  if (value0to9 >= 8.5) return "text-slate-900";
  if (value0to9 >= 7.0) return "text-slate-800";
  if (value0to9 >= 5.0) return "text-slate-700";
  return "text-slate-600";
}

function formatDialogue(dialogue: DialogueTurn[]) {
  // evaluator receives plain text log
  return dialogue
    .filter((t) => t.content.trim().length > 0)
    .map((t) => `${t.role.toUpperCase()}: ${t.content.trim()}`)
    .join("\n\n");
}

// -------------------- Page --------------------
export default function MentorAiIndexPage() {
  const [scenarioKey, setScenarioKey] = useState<ScenarioKey>("consulting");
  const scenario = useMemo(
    () => SCENARIOS.find((s) => s.key === scenarioKey)!,
    [scenarioKey]
  );

  const [step, setStep] = useState<Step>(1);

  // Timer (30min target, but not enforcing hard stop)
  const startedAtRef = useRef<number | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);

  // Inputs
  const [userPrompt, setUserPrompt] = useState("");
  const [dialogue, setDialogue] = useState<DialogueTurn[]>([
    { role: "user", content: "" },
    { role: "ai", content: "" },
    { role: "user", content: "" },
    { role: "ai", content: "" },
  ]);
  const [finalOutput, setFinalOutput] = useState("");
  const [optionalNotes, setOptionalNotes] = useState("");

  // Result
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<AcsResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Start timer on first interaction
  useEffect(() => {
    if (startedAtRef.current == null) startedAtRef.current = Date.now();
    const id = window.setInterval(() => {
      if (!startedAtRef.current) return;
      const sec = Math.floor((Date.now() - startedAtRef.current) / 1000);
      setElapsedSec(sec);
    }, 500);
    return () => window.clearInterval(id);
  }, []);

  // Reset when scenario changes
  const resetAll = (nextScenarioKey?: ScenarioKey) => {
    if (nextScenarioKey) setScenarioKey(nextScenarioKey);
    setStep(1);
    setUserPrompt("");
    setDialogue([
      { role: "user", content: "" },
      { role: "ai", content: "" },
      { role: "user", content: "" },
      { role: "ai", content: "" },
    ]);
    setFinalOutput("");
    setOptionalNotes("");
    setResult(null);
    setError(null);
    startedAtRef.current = Date.now();
    setElapsedSec(0);
  };

  const canNext = useMemo(() => {
    if (step === 1) return userPrompt.trim().length >= 20;
    if (step === 2) {
      const hasAny = dialogue.some((t) => t.content.trim().length > 0);
      return hasAny;
    }
    return true;
  }, [step, userPrompt, dialogue]);

  const onNext = () => {
    if (step === 3) return;
    setStep((prev) => (prev + 1) as Step);
  };
  const onPrev = () => {
    if (step === 1) return;
    setStep((prev) => (prev - 1) as Step);
  };

  const submit = async () => {
    setError(null);
    setIsSubmitting(true);
    setResult(null);
    try {
      const body = {
        scenario_key: scenario.key,
        task_prompt: scenario.task_prompt,
        user_prompt: clampText(userPrompt, 4000),
        dialogue_log: clampText(formatDialogue(dialogue), 8000),
        final_output: clampText(finalOutput, 4000),
        optional_notes: clampText(optionalNotes, 2000),
        time_spent_sec: Math.min(elapsedSec, 60 * 60), // cap 1h
        turn_count: dialogue.filter((t) => t.content.trim().length > 0).length,
      };

      const res = await fetch("/api/ai-training/eval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(
          `採点APIエラー (${res.status}): ${text || "Unknown error"}`
        );
      }

      const json = (await res.json()) as AcsResult;

      // minimal sanity
      if (!json?.scores?.final_acs && json?.scores?.final_acs !== 0) {
        throw new Error("採点結果の形式が不正です（scores.final_acs がありません）");
      }

      setResult(json);
      setStep(3);
    } catch (e: any) {
      setError(e?.message ?? "不明なエラー");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-4 py-10">
      <Header
        scenarioKey={scenarioKey}
        onScenarioChange={(k) => resetAll(k)}
        elapsedSec={elapsedSec}
      />

      {!result ? (
        <>
          <ScenarioBrief scenario={scenario} />

          <Progress step={step} />

          <section className="rounded-2xl border border-slate-100 bg-white/80 p-5 shadow-sm shadow-slate-100 backdrop-blur">
            <h2 className="mb-3 text-sm font-semibold text-slate-800">
              {stepTitle(step)}
            </h2>

            {step === 1 && (
              <Step1PromptDesign
                userPrompt={userPrompt}
                setUserPrompt={setUserPrompt}
                templateHint={scenario.finalOutputTemplate}
              />
            )}

            {step === 2 && (
              <Step2Dialogue
                dialogue={dialogue}
                setDialogue={setDialogue}
              />
            )}

            {step === 3 && (
              <Step3Final
                finalOutput={finalOutput}
                setFinalOutput={setFinalOutput}
                optionalNotes={optionalNotes}
                setOptionalNotes={setOptionalNotes}
                templateHint={scenario.finalOutputTemplate}
              />
            )}

            {error && (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800">
                {error}
              </div>
            )}

            <div className="mt-4 flex items-center justify-between">
              <button
                type="button"
                onClick={onPrev}
                disabled={step === 1 || isSubmitting}
                className="text-xs text-slate-400 hover:text-slate-600 disabled:cursor-not-allowed disabled:text-slate-300"
              >
                ← 前へ
              </button>

              <div className="flex items-center gap-2">
                {step < 3 ? (
                  <button
                    type="button"
                    onClick={onNext}
                    disabled={!canNext || isSubmitting}
                    className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-1.5 text-xs font-medium text-white shadow-sm shadow-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    次へ →
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={submit}
                    disabled={isSubmitting || finalOutput.trim().length < 40}
                    className="inline-flex items-center gap-2 rounded-full bg-sky-500 px-4 py-1.5 text-xs font-medium text-white shadow-sm shadow-sky-200 hover:bg-sky-600 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {isSubmitting ? "採点中…" : "採点して結果を見る"}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => resetAll()}
                  disabled={isSubmitting}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 hover:border-slate-300 disabled:cursor-not-allowed disabled:text-slate-300"
                >
                  リセット
                </button>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-4 text-[11px] text-slate-500">
            <p className="font-medium text-slate-700">この新UIの狙い</p>
            <p className="mt-1">
              “正解当て”ではなく、AI協働の<strong>行動</strong>（目的設定・制約設計・収束・安全性）を測ります。
              だから入力は「プロンプト」「対話ログ」「最終成果物」の3点セットに統一しています。
            </p>
          </section>
        </>
      ) : (
        <ResultView
          scenarioLabel={scenario.label}
          elapsedSec={elapsedSec}
          result={result}
          onRestart={() => resetAll()}
        />
      )}
    </main>
  );
}

// -------------------- UI Components --------------------
function Header({
  scenarioKey,
  onScenarioChange,
  elapsedSec,
}: {
  scenarioKey: ScenarioKey;
  onScenarioChange: (k: ScenarioKey) => void;
  elapsedSec: number;
}) {
  return (
    <header className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-500">
            ACS / AI Collaboration Score
          </p>
          <h1 className="text-2xl font-semibold text-slate-900">
            AI思考力トレーニング（30分テスト）
          </h1>
          <p className="text-sm text-slate-600">
            プロンプト設計 → 対話 → 成果物。AI協働の“実務耐性”を可視化します。
          </p>
        </div>

        <div className="shrink-0 rounded-2xl border border-slate-100 bg-white/70 px-4 py-3 text-xs text-slate-600 shadow-sm shadow-slate-100 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
              Time
            </span>
            <span className="tabular-nums font-semibold text-slate-800">
              {formatTime(elapsedSec)}
            </span>
          </div>
          <p className="mt-1 text-[10px] text-slate-400">
            目安：30:00（超えてもOK）
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-[11px]">
        {SCENARIOS.map((s) => {
          const active = s.key === scenarioKey;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => onScenarioChange(s.key)}
              className={
                "rounded-full border px-3 py-1 transition " +
                (active
                  ? "border-sky-500 bg-sky-50 text-sky-700"
                  : "border-slate-200 bg-white text-slate-500 hover:border-sky-200 hover:text-sky-600")
              }
            >
              {s.label}
            </button>
          );
        })}
      </div>
    </header>
  );
}

function ScenarioBrief({ scenario }: { scenario: Scenario }) {
  return (
    <section className="rounded-2xl border border-slate-100 bg-white/80 p-5 shadow-sm shadow-slate-100 backdrop-blur">
      <p className="text-xs font-semibold text-slate-800">シナリオ</p>
      <div className="mt-2 space-y-2 text-sm text-slate-700">
        <p>
          <span className="font-semibold">あなたの役割：</span>
          {scenario.briefing.role}
        </p>
        <p className="text-slate-700">{scenario.briefing.situation}</p>

        <div className="mt-3 rounded-xl bg-slate-50 px-4 py-3">
          <p className="text-xs font-semibold text-slate-700">制約条件</p>
          <ul className="mt-1 list-disc pl-5 text-xs text-slate-600">
            {scenario.briefing.constraints.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl bg-slate-50 px-4 py-3">
          <p className="text-xs font-semibold text-slate-700">ゴール</p>
          <p className="mt-1 text-xs text-slate-600">{scenario.briefing.goal}</p>
        </div>

        <div className="rounded-xl bg-slate-50 px-4 py-3">
          <p className="text-xs font-semibold text-slate-700">提出物ルール</p>
          <ul className="mt-1 list-disc pl-5 text-xs text-slate-600">
            {scenario.briefing.deliverableRules.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function Progress({ step }: { step: Step }) {
  return (
    <div className="flex items-center justify-between text-xs text-slate-500">
      <div>Step {step} / 3</div>
      <div className="flex gap-1">
        {[1, 2, 3].map((n) => (
          <span
            key={n}
            className={`h-1.5 w-16 rounded-full ${n <= step ? "bg-sky-500" : "bg-slate-200"
              }`}
          />
        ))}
      </div>
    </div>
  );
}

function stepTitle(step: Step) {
  if (step === 1) return "Step 1：プロンプト設計（最初の指示文）";
  if (step === 2) return "Step 2：対話ログ（最大4往復）";
  return "Step 3：最終成果物（200〜300字）＋任意メモ";
}

function Step1PromptDesign({
  userPrompt,
  setUserPrompt,
  templateHint,
}: {
  userPrompt: string;
  setUserPrompt: (v: string) => void;
  templateHint: string;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-700">
        あなたがAIに最初に投げる<strong>プロンプト</strong>を書いてください。
        制約・目的・出力形式を入れるほど再現性が上がります。
      </p>

      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
        <p className="font-semibold text-slate-700">ヒント（出力テンプレ）</p>
        <pre className="mt-1 whitespace-pre-wrap text-[11px] text-slate-600">
          {templateHint}
        </pre>
      </div>

      <textarea
        className="h-48 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none ring-sky-200 focus:bg-white focus:ring-2"
        value={userPrompt}
        onChange={(e) => setUserPrompt(e.target.value)}
        placeholder={`例：
あなたは〇〇の専門家です。
目的：…
制約：…
出力：箇条書き/テンプレに沿って…`}
      />
      <p className="text-right text-[11px] text-slate-400">
        {userPrompt.length}文字（目安：80〜250）
      </p>
    </div>
  );
}

function Step2Dialogue({
  dialogue,
  setDialogue,
}: {
  dialogue: DialogueTurn[];
  setDialogue: (v: DialogueTurn[]) => void;
}) {
  const update = (idx: number, content: string) => {
    const next = dialogue.slice();
    next[idx] = { ...next[idx], content };
    setDialogue(next);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-700">
        AIとの<strong>対話ログ</strong>を貼ってください（最大4往復）。
        「修正の仕方」「収束の速さ」も評価対象です。
      </p>

      <div className="grid gap-3">
        {dialogue.map((t, idx) => (
          <div key={idx} className="rounded-2xl border border-slate-100 bg-white p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-700">
                {t.role === "user" ? "USER（あなた）" : "AI"}
              </p>
              <p className="text-[10px] text-slate-400">
                {idx + 1} / {dialogue.length}
              </p>
            </div>
            <textarea
              className="mt-2 h-28 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none ring-sky-200 focus:bg-white focus:ring-2"
              value={t.content}
              onChange={(e) => update(idx, e.target.value)}
              placeholder={
                t.role === "user"
                  ? "あなたの指示・追加質問・修正指示を貼る"
                  : "AIの返答を貼る"
              }
            />
            <p className="mt-1 text-right text-[11px] text-slate-400">
              {t.content.length}文字
            </p>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-slate-500">
        ※ 実際のChatGPT画面からコピペでOK。ログが少なくても問題ありません（ただし未入力だと評価が薄くなります）。
      </p>
    </div>
  );
}

function Step3Final({
  finalOutput,
  setFinalOutput,
  optionalNotes,
  setOptionalNotes,
  templateHint,
}: {
  finalOutput: string;
  setFinalOutput: (v: string) => void;
  optionalNotes: string;
  setOptionalNotes: (v: string) => void;
  templateHint: string;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-700">
        最終成果物を<strong>200〜300字</strong>で作って貼ってください。
        “そのまま会議/業務で使えるか”が最重要です。
      </p>

      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
        <p className="font-semibold text-slate-700">テンプレ（任意）</p>
        <pre className="mt-1 whitespace-pre-wrap text-[11px] text-slate-600">
          {templateHint}
        </pre>
      </div>

      <textarea
        className="h-40 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none ring-sky-200 focus:bg-white focus:ring-2"
        value={finalOutput}
        onChange={(e) => setFinalOutput(e.target.value)}
        placeholder="ここに最終成果物（200〜300字）を貼ってください。"
      />
      <p className="text-right text-[11px] text-slate-400">
        {finalOutput.length}文字
      </p>

      <div className="rounded-2xl border border-slate-100 bg-white p-4">
        <p className="text-xs font-semibold text-slate-700">
          任意メモ（あなたの意図・迷った点など）
        </p>
        <textarea
          className="mt-2 h-24 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none ring-sky-200 focus:bg-white focus:ring-2"
          value={optionalNotes}
          onChange={(e) => setOptionalNotes(e.target.value)}
          placeholder="例：どこをAIに任せるか迷った、断定を避けた、など"
        />
      </div>

      <p className="text-[11px] text-slate-500">
        ※ 「AI/人の役割分担」「前提」「注意点」が入ると Compliance が上がりやすいです。
      </p>
    </div>
  );
}

function ResultView({
  scenarioLabel,
  elapsedSec,
  result,
  onRestart,
}: {
  scenarioLabel: string;
  elapsedSec: number;
  result: AcsResult;
  onRestart: () => void;
}) {
  const s = result.scores;
  const finalAcs = toOneDecimal(s.final_acs);
  const baseAcs = toOneDecimal(s.base_acs);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-sky-100 bg-white/90 p-6 shadow-sm shadow-sky-100 backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-500">
          Result
        </p>

        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              ACS評価結果
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              シナリオ：{scenarioLabel} / 所要：{formatTime(elapsedSec)}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700">
              base {baseAcs}
            </span>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-900">
              final {finalAcs} / 9.0
            </span>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <span
            className={
              "inline-flex items-center rounded-full border px-3 py-1 text-[11px] " +
              gradeBadge(result.modifiers.compliance)
            }
          >
            Compliance：{result.modifiers.compliance}
          </span>
          <span
            className={
              "inline-flex items-center rounded-full border px-3 py-1 text-[11px] " +
              gradeBadge(result.modifiers.efficiency)
            }
          >
            Efficiency：{result.modifiers.efficiency}
          </span>

          {result.flags.pii_or_secret_risk && (
            <span className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[11px] text-rose-700">
              PII/機密リスク
            </span>
          )}
          {result.flags.hallucination_risk && (
            <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] text-amber-700">
              誤情報リスク
            </span>
          )}
          {result.flags.overdelegation_risk && (
            <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] text-amber-700">
              丸投げリスク
            </span>
          )}
        </div>

        <p className="mt-4 text-sm text-slate-700">
          <span className="font-semibold">一言診断：</span>
          {result.diagnosis.one_liner}
        </p>

        <div className="mt-5 grid gap-3 text-xs text-slate-700 md:grid-cols-2">
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-[11px] font-semibold text-slate-800">
              Strengths / 強み（上位3）
            </p>
            <ul className="mt-2 list-disc pl-5 text-[11px] text-slate-700">
              {result.diagnosis.top_strengths.slice(0, 3).map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-[11px] font-semibold text-slate-800">
              Gaps / 改善ポイント（上位3）
            </p>
            <ul className="mt-2 list-disc pl-5 text-[11px] text-slate-700">
              {result.diagnosis.top_gaps.slice(0, 3).map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-slate-100 bg-white p-4">
          <p className="text-[11px] font-semibold text-slate-800">
            Score Breakdown（0.0〜9.0）
          </p>
          <div className="mt-3 grid gap-2">
            <ScoreRow label="Goal Framing" value={s.goal_framing} />
            <ScoreRow label="Constraint Design" value={s.constraint_design} />
            <ScoreRow label="Structuring" value={s.structuring} />
            <ScoreRow label="Evaluation" value={s.evaluation} />
            <ScoreRow label="Iterative Refinement" value={s.iterative_refinement} />
            <ScoreRow label="Final Output Quality" value={s.final_output_quality} />
          </div>
        </div>

        <div className="mt-5 grid gap-3 text-[11px] text-slate-700 md:grid-cols-2">
          <div className="rounded-xl bg-emerald-50/50 p-4">
            <p className="font-semibold text-slate-800">Evidence（良い点）</p>
            <ul className="mt-2 list-disc pl-5">
              {result.evidence.positive.filter(Boolean).slice(0, 2).map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl bg-rose-50/50 p-4">
            <p className="font-semibold text-slate-800">Risk（注意点）</p>
            <ul className="mt-2 list-disc pl-5">
              {result.evidence.risk.filter(Boolean).slice(0, 2).map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-5 rounded-xl bg-slate-50 p-4">
          <p className="text-[11px] font-semibold text-slate-800">
            Next Actions（次の練習）
          </p>
          <ul className="mt-2 list-disc pl-5 text-[11px] text-slate-700">
            {result.diagnosis.next_actions.slice(0, 3).map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </div>

        <div className="mt-6 flex items-center justify-between">
          <button
            type="button"
            onClick={onRestart}
            className="text-[11px] text-slate-400 hover:text-slate-700"
          >
            もう一度やる →
          </button>

          <details className="text-[11px] text-slate-500">
            <summary className="cursor-pointer select-none">
              JSON（デバッグ用）
            </summary>
            <pre className="mt-2 max-h-64 overflow-auto rounded-xl border border-slate-200 bg-white p-3 text-[10px] text-slate-700">
              {JSON.stringify(result, null, 2)}
            </pre>
          </details>
        </div>
      </section>
    </div>
  );
}

function ScoreRow({ label, value }: { label: string; value: number }) {
  const v = toOneDecimal(value);
  const pct = Math.max(0, Math.min(100, (v / 9) * 100));
  return (
    <div className="flex items-center gap-3">
      <div className="w-44 text-[11px] text-slate-600">{label}</div>
      <div className="flex-1">
        <div className="h-2 w-full rounded-full bg-slate-200">
          <div
            className="h-2 rounded-full bg-slate-900"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <div className={"w-14 text-right text-[11px] " + scoreColor(v)}>
        {v.toFixed(1)}
      </div>
    </div>
  );
}

function formatTime(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}
