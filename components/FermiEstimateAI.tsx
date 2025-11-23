// src/components/FermiEstimateAI.tsx
"use client";

import React, { useState } from "react";

/* -------------------------------
   型定義
-------------------------------- */
type FermiFactor = {
  id: number;
  name: string;
  operator: "×" | "+";
  assumption: string;
  rationale: string;
  value: string;
};

type FermiScore = {
  reframing: number;
  decomposition: number;
  assumptions: number;
  numbersSense: number;
  sanityCheck: number;
};

type FermiFeedback = {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  advice: string;
  sampleAnswer: string;
  totalScore: number;
};

type FermiCategory = "daily" | "business" | "consulting";
type FermiDifficulty = "easy" | "medium" | "hard";

type FermiProblem = {
  id: string;
  category: FermiCategory;
  difficulty: FermiDifficulty;
  title: string;
  formulaHint: string;
  defaultFactors: string[];
  unit: string;
};

/* -------------------------------
   ローカル問題バンク（無限生成デモ）
-------------------------------- */
const FERMI_PROBLEM_BANK: FermiProblem[] = [
  {
    id: "jp-cafe-market",
    category: "business",
    difficulty: "medium",
    title: "日本のカフェ市場規模（年間売上）",
    formulaHint: "人口 × 利用割合 × 年間利用回数 × 平均客単価",
    defaultFactors: ["人口", "カフェ利用割合", "年間利用回数", "平均客単価"],
    unit: "円 / 年",
  },
  {
    id: "tokyo-taxi",
    category: "consulting",
    difficulty: "medium",
    title: "東京都内を走っているタクシーの台数",
    formulaHint: "人口 × タクシー利用割合 × 1台あたりの処理人数",
    defaultFactors: [
      "都内人口",
      "タクシー利用割合",
      "1台あたり1日の利用人数",
      "稼働日数",
    ],
    unit: "台",
  },
  {
    id: "daily-coffee",
    category: "daily",
    difficulty: "easy",
    title: "日本人1人あたり1年間で飲むコーヒーの杯数",
    formulaHint: "人口 × コーヒー飲む人の割合 × 1日の杯数 × 日数",
    defaultFactors: [
      "人口",
      "コーヒー飲む人の割合",
      "1日あたりの杯数",
      "1年間の日数",
    ],
    unit: "杯 / 年",
  },
  {
    id: "cinema-revenue",
    category: "business",
    difficulty: "hard",
    title: "日本の映画館の年間チケット売上",
    formulaHint: "人口 × 映画館利用割合 × 年間鑑賞回数 × 平均チケット単価",
    defaultFactors: [
      "人口",
      "映画館利用割合",
      "年間鑑賞回数",
      "平均チケット単価",
    ],
    unit: "円 / 年",
  },
];

/* -------------------------------
   メインコンポーネント
-------------------------------- */
export const FermiEstimateAI: React.FC = () => {
  const [question, setQuestion] = useState("");
  const [formula, setFormula] = useState("");
  const [unit, setUnit] = useState("件 / 年");
  const [factors, setFactors] = useState<FermiFactor[]>([]);
  const [result, setResult] = useState<string>("");
  const [sanityComment, setSanityComment] = useState("");

  const [category, setCategory] = useState<FermiCategory>("business");
  const [difficulty, setDifficulty] = useState<FermiDifficulty>("medium");
  const [currentProblemId, setCurrentProblemId] = useState<string | null>(null);

  // スコア & フィードバック
  const [score, setScore] = useState<FermiScore>({
    reframing: 0,
    decomposition: 0,
    assumptions: 0,
    numbersSense: 0,
    sanityCheck: 0,
  });
  const [feedback, setFeedback] = useState<FermiFeedback | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);

  /* -------------------------------
     無限フェルミ問題生成
  -------------------------------- */
  const materializeProblem = (problem: FermiProblem) => {
    setCurrentProblemId(problem.id);
    setQuestion(problem.title);
    setFormula(problem.formulaHint);
    setUnit(problem.unit);
    setResult("");
    setSanityComment("");
    setFeedback(null);
    setScore({
      reframing: 0,
      decomposition: 0,
      assumptions: 0,
      numbersSense: 0,
      sanityCheck: 0,
    });

    setFactors(
      problem.defaultFactors.map((name, idx) => ({
        id: Date.now() + idx,
        name,
        operator: "×",
        assumption: "",
        rationale: "",
        value: "",
      }))
    );
  };

  const generateNewProblem = () => {
    const candidates = FERMI_PROBLEM_BANK.filter(
      (p) => p.category === category && p.difficulty === difficulty
    );
    const pool = candidates.length > 0 ? candidates : FERMI_PROBLEM_BANK;
    const random = pool[Math.floor(Math.random() * pool.length)];
    materializeProblem(random);
  };

  /* -------------------------------
     要素操作
  -------------------------------- */
  const addFactor = () => {
    setFactors((prev) => [
      ...prev,
      {
        id: Date.now(),
        name: "",
        operator: "×",
        assumption: "",
        rationale: "",
        value: "",
      },
    ]);
  };

  const updateFactor = (id: number, field: keyof FermiFactor, value: string) => {
    setFactors((prev) =>
      prev.map((f) => (f.id === id ? { ...f, [field]: value } : f))
    );
  };

  /* -------------------------------
     計算
  -------------------------------- */
  const handleCompute = () => {
    try {
      const numericValues = factors.map((f) => Number(f.value || "0") || 0);
      const product = numericValues.reduce(
        (acc, cur) => (acc === null ? cur : acc * cur),
        null as number | null
      );
      if (product === null) {
        setResult("");
      } else {
        setResult(`${product.toExponential(2)} ${unit}（概算）`);
      }
    } catch {
      setResult("計算エラー（入力値を確認してください）");
    }
  };

  /* -------------------------------
     AI 採点（＋フィードバック）
  -------------------------------- */
  const handleEvaluate = async () => {
    setIsEvaluating(true);

    const payload = {
      question,
      formula,
      unit,
      factors,
      sanityComment,
      problemId: currentProblemId,
      category,
      difficulty,
    };

    try {
      const res = await fetch("/api/eval/fermi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Eval API error");

      const data = await res.json();

      if (data.score) {
        setScore(data.score);
      }
      if (data.feedback) {
        setFeedback(data.feedback);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsEvaluating(false);
    }
  };

  /* -------------------------------
     UI
  -------------------------------- */
  return (
    <div className="flex h-full gap-6">
      {/* 左カラム */}
      <div className="flex-1 space-y-6 overflow-y-auto pr-2">
        {/* 無限フェルミ問題ガチャ */}
        <section className="rounded-2xl border border-sky-100 bg-sky-50/70 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-sm font-semibold text-sky-900">
                Fermi Estimation Trainer
              </h1>
              <p className="text-[11px] text-sky-700 mt-1">
                カテゴリと難易度を選んで「新しい問題を出す」を押すと、フェルミ問題が無限に出題されます。
              </p>
            </div>
            <button
              type="button"
              onClick={generateNewProblem}
              className="rounded-full bg-sky-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-sky-600"
            >
              🎲 新しい問題を出す
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-3">
            <div>
              <label className="text-[11px] text-slate-600">カテゴリ</label>
              <select
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white/80 px-2 py-1.5 text-xs"
                value={category}
                onChange={(e) => setCategory(e.target.value as FermiCategory)}
              >
                <option value="daily">Daily（日常）</option>
                <option value="business">Business</option>
                <option value="consulting">Consulting</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] text-slate-600">難易度</label>
              <select
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white/80 px-2 py-1.5 text-xs"
                value={difficulty}
                onChange={(e) =>
                  setDifficulty(e.target.value as FermiDifficulty)
                }
              >
                <option value="easy">⭐ Easy</option>
                <option value="medium">⭐⭐ Medium</option>
                <option value="hard">⭐⭐⭐ Hard</option>
              </select>
            </div>
            <div className="flex items-end">
              <div className="w-full text-[11px] text-slate-500">
                {currentProblemId ? (
                  <>
                    現在の問題ID：{" "}
                    <span className="font-mono text-slate-700">
                      {currentProblemId}
                    </span>
                  </>
                ) : (
                  "まずは「新しい問題を出す」を押してスタート。"
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ① 再定義 */}
        <section className="rounded-2xl border border-slate-200 bg-white/70 p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700 mb-2">
            ① 問題の再定義（Reframe）
          </h2>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-slate-500">お題 / Question</label>
              <textarea
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white/80 p-2 text-sm"
                rows={2}
                placeholder="例：日本のカフェ市場規模は？"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="text-xs text-slate-500">式（Formula）</label>
                <input
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white/80 px-2 py-1.5 text-sm"
                  placeholder="人口 × 利用割合 × 年間利用回数 × 平均単価"
                  value={formula}
                  onChange={(e) => setFormula(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-slate-500">単位（Unit）</label>
                <select
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white/80 px-2 py-1.5 text-sm"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                >
                  <option>件 / 年</option>
                  <option>円 / 年</option>
                  <option>円 / 月</option>
                  <option>人</option>
                  <option>台</option>
                  <option>杯 / 年</option>
                </select>
              </div>
            </div>
          </div>
        </section>

        {/* ② 要素分解 */}
        <section className="rounded-2xl border border-slate-200 bg-white/70 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-slate-700">
              ② 要素分解（MECE）
            </h2>
            <button
              type="button"
              className="rounded-lg border border-sky-200 px-2.5 py-1 text-xs text-sky-700 hover:bg-sky-50"
              onClick={addFactor}
            >
              要因を追加
            </button>
          </div>
          <p className="mb-2 text-xs text-slate-500">
            最低 2〜3 要因に分解し、「掛け算 or 足し算」を意識する。
          </p>
          <div className="space-y-3">
            {factors.map((factor, index) => (
              <div
                key={factor.id}
                className="rounded-xl border border-slate-100 bg-slate-50/70 p-3"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] rounded-full bg-slate-200 px-2 py-0.5 text-slate-600">
                    Factor {index + 1}
                  </span>
                  <select
                    className="rounded-lg border border-slate-200 bg-white/80 px-1.5 py-1 text-[11px]"
                    value={factor.operator}
                    onChange={(e) =>
                      updateFactor(factor.id, "operator", e.target.value)
                    }
                  >
                    <option value="×">掛け算（×）</option>
                    <option value="+">足し算（＋）</option>
                  </select>
                  <input
                    className="flex-1 rounded-lg border border-slate-200 bg-white/80 px-2 py-1 text-xs"
                    placeholder="例：年間利用回数"
                    value={factor.name}
                    onChange={(e) =>
                      updateFactor(factor.id, "name", e.target.value)
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div>
                    <label className="text-[10px] text-slate-500">
                      仮定（Assumption）
                    </label>
                    <input
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white/80 px-2 py-1 text-xs"
                      value={factor.assumption}
                      onChange={(e) =>
                        updateFactor(factor.id, "assumption", e.target.value)
                      }
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500">
                      根拠（Reason）
                    </label>
                    <input
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white/80 px-2 py-1 text-xs"
                      value={factor.rationale}
                      onChange={(e) =>
                        updateFactor(factor.id, "rationale", e.target.value)
                      }
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-slate-500">
                    数値（丸め後）
                  </label>
                  <input
                    className="mt-1 w-40 rounded-lg border border-slate-200 bg-white/80 px-2 py-1 text-xs"
                    placeholder="例：50000000"
                    value={factor.value}
                    onChange={(e) =>
                      updateFactor(factor.id, "value", e.target.value)
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ③ 計算 */}
        <section className="rounded-2xl border border-slate-200 bg-white/70 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-slate-700">
              ④ 計算（Computation）
            </h2>
            <button
              type="button"
              className="rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-sky-600"
              onClick={handleCompute}
            >
              概算を計算する
            </button>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-sm min-h-[48px]">
            {result || "ここに概算結果が表示されます。"}
          </div>
        </section>

        {/* ④ オーダーチェック */}
        <section className="rounded-2xl border border-slate-200 bg-white/70 p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700 mb-2">
            ⑤ オーダーチェック（Sanity Check）
          </h2>
          <textarea
            className="w-full rounded-xl border border-slate-200 bg-white/80 p-2 text-sm"
            rows={3}
            placeholder="例：スタバ売上や飲食市場と比較して 1〜2桁以内なので妥当。"
            value={sanityComment}
            onChange={(e) => setSanityComment(e.target.value)}
          />
        </section>

        {/* AI 採点ボタン */}
        <section className="flex justify-end mb-6">
          <button
            type="button"
            onClick={handleEvaluate}
            disabled={isEvaluating}
            className={`rounded-full px-5 py-2 text-xs font-semibold text-white ${
              isEvaluating
                ? "bg-slate-300 cursor-not-allowed"
                : "bg-violet-500 hover:bg-violet-600"
            }`}
          >
            {isEvaluating ? "AIが採点中…" : "AIに採点してもらう"}
          </button>
        </section>

        {/* フィードバック表示（模範回答ゾーン） */}
        {feedback && (
          <section className="mb-8 rounded-2xl border border-violet-100 bg-violet-50/60 p-4 shadow-sm">
            <h3 className="text-xs font-semibold text-violet-700 mb-2">
              フィードバック & 模範回答イメージ
            </h3>

            <p className="text-xs text-slate-700 mb-3">{feedback.summary}</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              <div className="rounded-xl bg-white/80 p-3 border border-slate-100">
                <p className="text-[11px] font-semibold text-emerald-600 mb-1">
                  👍 良いポイント
                </p>
                <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-700">
                  {feedback.strengths.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl bg-white/80 p-3 border border-slate-100">
                <p className="text-[11px] font-semibold text-rose-600 mb-1">
                  ⚠ 改善ポイント
                </p>
                <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-700">
                  {feedback.weaknesses.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            </div>

            <p className="text-[11px] text-slate-600 mb-2">
              アドバイス：{feedback.advice}
            </p>

            <div className="rounded-xl bg-white/90 border border-slate-100 px-3 py-2">
              <p className="text-[11px] font-semibold text-slate-700 mb-1">
                模範回答イメージ
              </p>
              <pre className="whitespace-pre-wrap text-[11px] text-slate-700">
                {feedback.sampleAnswer}
              </pre>
            </div>
          </section>
        )}
      </div>

      {/* 右カラム：スコアパネル */}
      <aside className="w-64 shrink-0 space-y-4">
        <div className="rounded-2xl border border-sky-100 bg-sky-50/70 p-4 shadow-sm">
          <h3 className="text-xs font-semibold tracking-wide text-sky-700 mb-2">
            型スコア（Fermi Pattern）
          </h3>
          <ul className="space-y-1.5 text-xs text-slate-700">
            <li className="flex justify-between">
              <span>再定義</span>
              <span className="font-semibold">{score.reframing}</span>
            </li>
            <li className="flex justify-between">
              <span>要素分解</span>
              <span className="font-semibold">{score.decomposition}</span>
            </li>
            <li className="flex justify-between">
              <span>仮定の質</span>
              <span className="font-semibold">{score.assumptions}</span>
            </li>
            <li className="flex justify-between">
              <span>数字感</span>
              <span className="font-semibold">{score.numbersSense}</span>
            </li>
            <li className="flex justify-between">
              <span>オーダー感</span>
              <span className="font-semibold">{score.sanityCheck}</span>
            </li>
          </ul>
        </div>

        {feedback && (
          <div className="rounded-2xl border border-violet-100 bg-white/80 p-4 shadow-sm">
            <p className="text-[11px] text-slate-500 mb-1">
              合計スコア（仮）
            </p>
            <p className="text-2xl font-semibold text-slate-900">
              {feedback.totalScore}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              ※ フルスコア 50 点想定（V1.5 で正式設計）
            </p>
          </div>
        )}
      </aside>
    </div>
  );
};
