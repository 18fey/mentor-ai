// src/components/CaseInterviewAI.tsx
"use client";

import React, { useState } from "react";

/* ============================
   型定義
============================ */

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

/* ============================
   ローカル問題バンク
   （後でAPIに差し替え可能）
============================ */

const CASE_BANK: CaseQuestion[] = [
  {
    id: "consulting_market_cafe",
    domain: "consulting",
    pattern: "market_sizing",
    title: "全国カフェチェーンの市場規模",
    client: "大手外食チェーン",
    prompt:
      "クライアントは、既存のレストラン事業に加えてカフェ事業への本格参入を検討している。日本のカフェ市場規模を推定し、成長余地があるかどうかを評価してほしい。",
    hint:
      "人口 × カフェ利用者割合 × 利用頻度 × 平均客単価、エリア別・フォーマット別に分けるなどの切り口もありうる。",
    kpiExamples:
      "年間売上規模、店舗あたり売上、客単価、来店頻度、競合のシェア など。",
  },
  {
    id: "general_profit_fashion_ec",
    domain: "general",
    pattern: "profitability",
    title: "アパレルECサイトの利益改善",
    client: "D2Cアパレルブランド",
    prompt:
      "クライアントはオンライン限定のアパレルブランド。売上は伸びているものの、広告費と物流費の増加により営業利益率が悪化している。利益改善のための打ち手を検討してほしい。",
    hint:
      "売上（客数 × 客単価）とコスト（変動費・固定費）に分解し、どこにレバーがありそうかを考える。",
    kpiExamples:
      "ROAS、LTV/CAC、返品率、在庫回転日数、1件あたり配送コスト など。",
  },
  {
    id: "trading_entry_chemical",
    domain: "trading",
    pattern: "entry",
    title: "新興国向け化学品ビジネスへの参入可否",
    client: "総合商社（化学部門）",
    prompt:
      "クライアントは総合商社。ある新興国で、環境規制の強化に伴い高機能化学品の需要が高まっている。現地メーカーと組んで市場参入すべきかどうか、参入戦略も含めて提案してほしい。",
    hint:
      "①市場魅力度（成長率・規模・規制）②競合状況③自社の強み④スキーム案（JV／出資／販売代理）などに分解すると整理しやすい。",
    kpiExamples:
      "IRR、投下資本回収期間、シェア目標、契約数量、マージン水準 など。",
  },
  {
    id: "ib_synergy_mna",
    domain: "ib",
    pattern: "new_business",
    title: "クロスボーダーM&Aのシナジー評価",
    client: "日系製造業（欧州企業買収案件）",
    prompt:
      "クライアントは日系製造業。欧州競合企業の買収を検討しており、買収プレミアムを正当化できるだけのシナジーが見込めるかを評価してほしい。",
    hint:
      "売上シナジー（クロスセル・新市場）、コストシナジー（統合・調達・生産）、財務シナジー（税・資本コスト）などに分けて定量・定性両面から検討する。",
    kpiExamples:
      "シナジーNPV、プレミアム比率、EBITDAマージン改善、WACC、レバレッジ など。",
  },
  {
    id: "consulting_operation_store",
    domain: "consulting",
    pattern: "operation",
    title: "コンビニ店舗オペレーションの生産性向上",
    client: "大手コンビニチェーン",
    prompt:
      "人件費高騰と人手不足を背景に、コンビニ店舗のオペレーション生産性を高める必要がある。店舗オペレーションをどのように分解し、どこから改善すべきか提案してほしい。",
    hint:
      "レジ対応・品出し・発注・清掃・バックオフィスなどのタスクと時間を分解し、自動化・標準化・シフト再設計を検討する。",
    kpiExamples:
      "1店舗あたり人件費率、1人あたり処理件数、レジ待ち時間、在庫ロス率 など。",
  },
];

/* ============================
   メインコンポーネント
============================ */

export const CaseInterviewAI: React.FC = () => {
  // ケース選択
  const [domain, setDomain] = useState<CaseDomain>("consulting");
  const [pattern, setPattern] = useState<CasePattern>("market_sizing");
  const [currentCase, setCurrentCase] = useState<CaseQuestion | null>(null);

  // 回答（ステップ別）
  const [goal, setGoal] = useState("");
  const [kpi, setKpi] = useState("");
  const [framework, setFramework] = useState("");
  const [hypothesis, setHypothesis] = useState("");
  const [deepDivePlan, setDeepDivePlan] = useState("");
  const [analysis, setAnalysis] = useState("");
  const [solutions, setSolutions] = useState("");
  const [risks, setRisks] = useState("");
  const [wrapUp, setWrapUp] = useState("");

  // 評価
  const [score, setScore] = useState<CaseScore>({
    structure: 0,
    hypothesis: 0,
    insight: 0,
    practicality: 0,
    communication: 0,
  });
  const [feedback, setFeedback] = useState<CaseFeedback | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);

  /* -------------------------
     ケース自動生成
  ------------------------- */
  const handleGenerateCase = () => {
    const candidates = CASE_BANK.filter(
      (c) => c.domain === domain && c.pattern === pattern
    );
    const pool = candidates.length > 0 ? candidates : CASE_BANK;
    const random = pool[Math.floor(Math.random() * pool.length)];

    setCurrentCase(random);

    // 回答リセット
    setGoal("");
    setKpi("");
    setFramework("");
    setHypothesis("");
    setDeepDivePlan("");
    setAnalysis("");
    setSolutions("");
    setRisks("");
    setWrapUp("");
    setScore({
      structure: 0,
      hypothesis: 0,
      insight: 0,
      practicality: 0,
      communication: 0,
    });
    setFeedback(null);
  };

  /* -------------------------
     AIっぽいダミー評価
     （後で /api/eval/case に差し替え）
  ------------------------- */
  const handleEvaluate = async () => {
    if (!currentCase) return;

    setIsEvaluating(true);

    const textLength =
      goal.length +
      kpi.length +
      framework.length +
      hypothesis.length +
      deepDivePlan.length +
      analysis.length +
      solutions.length +
      risks.length +
      wrapUp.length;

    // 超簡易：文字数ベースでダミースコア
    const base = Math.min(10, Math.max(3, Math.floor(textLength / 250)));

    const newScore: CaseScore = {
      structure: base,
      hypothesis: base + (framework ? 1 : 0),
      insight: base - 1 >= 3 ? base - 1 : base,
      practicality: base,
      communication: base,
    };

    const fb: CaseFeedback = {
      summary:
        "全体として、構造化と仮説思考はある程度できており、ケース面接として十分に戦える土台があります。",
      goodPoints:
        "・ゴールとKPIを最初に定義しようとしている点\n・フレームワークを使って抜け漏れを減らそうとしている点\n・打ち手にKPIやインパクトの視点が含まれている点",
      improvePoints:
        "・『なぜそのKPIなのか』『なぜその切り口なのか』の理由を一歩深く言えると一気にコンサルっぽくなります。\n・分析パートで、数字やオーダー感をもう1行入れると説得力が増します。\n・結論パートでは「結論 → 理由3つ → 打ち手 → リスク・次ステップ」の型を意識すると安定します。",
      nextTraining:
        "次のトレーニングでは、同じケースをもう一度解いて『KPIの理由』『深掘りのWhy』だけを強化してみると伸びやすいです。",
    };

    setScore(newScore);
    setFeedback(fb);
    setIsEvaluating(false);
  };

  /* -------------------------
     レイアウト
  ------------------------- */

  return (
    <div className="flex h-full gap-6">
      {/* 左：ケース生成 + 回答入力 */}
      <div className="flex-1 space-y-6 overflow-y-auto pr-2">
        {/* ケースガチャ */}
        <section className="rounded-2xl border border-sky-100 bg-sky-50/70 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-sm font-semibold text-sky-900">
                Case Interview Trainer
              </h1>
              <p className="mt-1 text-[11px] text-sky-700">
                業界とケース種別を選んで「新しいケースを出す」を押すと、ケース問題が自動生成されます。
              </p>
            </div>
            <button
              type="button"
              onClick={handleGenerateCase}
              className="rounded-full bg-sky-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-sky-600"
            >
              🎲 新しいケースを出す
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-2">
            <div>
              <label className="text-[11px] text-slate-600">業界モード</label>
              <select
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white/80 px-2 py-1.5 text-xs outline-none"
                value={domain}
                onChange={(e) => setDomain(e.target.value as CaseDomain)}
              >
                <option value="consulting">コンサル</option>
                <option value="general">日系総合（商社・メーカー等）</option>
                <option value="trading">総合商社ケース</option>
                <option value="ib">外銀IB / M&amp;A</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] text-slate-600">
                ケースの種類
              </label>
              <select
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white/80 px-2 py-1.5 text-xs outline-none"
                value={pattern}
                onChange={(e) => setPattern(e.target.value as CasePattern)}
              >
                <option value="market_sizing">市場規模</option>
                <option value="profitability">利益改善</option>
                <option value="entry">市場参入</option>
                <option value="new_business">新規事業 / M&amp;A</option>
                <option value="operation">オペレーション改善</option>
              </select>
            </div>
            <div className="flex items-end">
              <p className="w-full text-[11px] text-slate-500">
                {currentCase ? (
                  <>
                    現在のケースID:{" "}
                    <span className="font-mono">{currentCase.id}</span>
                  </>
                ) : (
                  "まずは「新しいケースを出す」でスタート。"
                )}
              </p>
            </div>
          </div>
        </section>

        {/* ケース本文 */}
        <section className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold text-slate-800">
            ① ケース本文
          </h2>
          {currentCase ? (
            <div className="space-y-2 text-xs text-slate-700">
              <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-[11px] text-slate-600 mb-1">
                <span className="font-semibold">{currentCase.client}</span>
                <span className="text-slate-400">/</span>
                <span>{currentCase.title}</span>
              </div>
              <p>{currentCase.prompt}</p>
              <p className="text-[11px] text-slate-500">
                ヒント：{currentCase.hint}
              </p>
              <p className="text-[11px] text-slate-500">
                KPI例：{currentCase.kpiExamples}
              </p>
            </div>
          ) : (
            <p className="text-xs text-slate-400">
              ケースはまだ選ばれていません。「新しいケースを出す」を押してください。
            </p>
          )}
        </section>

        {/* ゴール再定義 */}
        <section className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold text-slate-800">
            ② ゴールとKPIの再定義
          </h2>
          <div className="space-y-3 text-xs">
            <div>
              <label className="text-[11px] text-slate-500">
                ゴール（何を最大化 / 最適化する？）
              </label>
              <textarea
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white/80 p-2 text-sm outline-none"
                rows={2}
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="例：クライアントの〇〇事業における中期的な利益成長と市場ポジションの最大化 など"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-500">
                KPI（追うべき指標）
              </label>
              <textarea
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white/80 p-2 text-sm outline-none"
                rows={2}
                value={kpi}
                onChange={(e) => setKpi(e.target.value)}
                placeholder="例：売上成長率 / EBITDAマージン / シェア / 投下資本利益率(ROIC) など"
              />
            </div>
          </div>
        </section>

        {/* フレームワーク & 仮説 */}
        <section className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold text-slate-800">
            ③ フレームワーク & 仮説
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 text-xs">
            <div>
              <label className="text-[11px] text-slate-500">
                フレーム / 分解の仕方
              </label>
              <textarea
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white/80 p-2 text-sm outline-none"
                rows={4}
                value={framework}
                onChange={(e) => setFramework(e.target.value)}
                placeholder="例：市場魅力度 / 競争優位 / 実行可能性 の3軸で評価する など"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-500">
                初期仮説（1〜2行でOK）
              </label>
              <textarea
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white/80 p-2 text-sm outline-none"
                rows={4}
                value={hypothesis}
                onChange={(e) => setHypothesis(e.target.value)}
                placeholder="例：競合がまだ少なく、既存アセットを活かせれば高い収益性が期待できる など"
              />
            </div>
          </div>
        </section>

        {/* 深掘りプラン / 分析 */}
        <section className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold text-slate-800">
            ④ 深掘りの進め方 & 分析
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 text-xs">
            <div>
              <label className="text-[11px] text-slate-500">
                何から確認する？（深掘り順序）
              </label>
              <textarea
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white/80 p-2 text-sm outline-none"
                rows={4}
                value={deepDivePlan}
                onChange={(e) => setDeepDivePlan(e.target.value)}
                placeholder="例：①市場サイズと成長率 → ②競合のポジション → ③自社のアセット適合度… の順に確認 など"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-500">
                分析のメモ（数字・示唆）
              </label>
              <textarea
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white/80 p-2 text-sm outline-none"
                rows={4}
                value={analysis}
                onChange={(e) => setAnalysis(e.target.value)}
                placeholder="例：売上 = 顧客数 × 単価 でざっくり試算し、オーダー感をコメント など"
              />
            </div>
          </div>
        </section>

        {/* 打ち手 & リスク / クロージング */}
        <section className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold text-slate-800">
            ⑤ 打ち手・リスク・まとめ
          </h2>
          <div className="space-y-3 text-xs">
            <div>
              <label className="text-[11px] text-slate-500">
                打ち手（3つ以内に絞る）
              </label>
              <textarea
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white/80 p-2 text-sm outline-none"
                rows={3}
                value={solutions}
                onChange={(e) => setSolutions(e.target.value)}
                placeholder="例：①高単価プレミアムラインの導入 ②既存チャネルとのクロスセル ③在庫・物流の統合 など"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-500">
                リスク & 前提（1〜3行）
              </label>
              <textarea
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white/80 p-2 text-sm outline-none"
                rows={3}
                value={risks}
                onChange={(e) => setRisks(e.target.value)}
                placeholder="例：規制変更や為替変動の影響 など"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-500">
                クロージング（結論 → 理由 → 次アクション）
              </label>
              <textarea
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white/80 p-2 text-sm outline-none"
                rows={3}
                value={wrapUp}
                onChange={(e) => setWrapUp(e.target.value)}
                placeholder="例：以上から、本案件は〇〇という前提のもとで参入メリットが大きいと考えます。まずは〜 など"
              />
            </div>
          </div>
        </section>

        {/* 評価ボタン */}
        <section className="mb-6 flex justify-end">
          <button
            type="button"
            onClick={handleEvaluate}
            disabled={isEvaluating || !currentCase}
            className={`rounded-full px-5 py-2 text-xs font-semibold text-white ${
              isEvaluating || !currentCase
                ? "bg-slate-300 cursor-not-allowed"
                : "bg-violet-500 hover:bg-violet-600"
            }`}
          >
            {isEvaluating
              ? "AIがケース回答を解析中…"
              : "AIにケース回答を評価してもらう（ダミー）"}
          </button>
        </section>
      </div>

      {/* 右：スコア & フィードバック */}
      <aside className="w-72 shrink-0 space-y-4">
        <div className="rounded-2xl border border-sky-100 bg-sky-50/80 p-4 shadow-sm">
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-sky-700">
            ケース構造スコア
          </h3>
          <p className="mb-2 text-[11px] text-sky-800">
            ※ 今はダミー値。将来は Eval API の結果をここに反映。
          </p>
          <ul className="space-y-1.5 text-xs text-slate-700">
            <li className="flex justify-between">
              <span>構造化（MECE）</span>
              <span className="font-semibold">{score.structure}/10</span>
            </li>
            <li className="flex justify-between">
              <span>仮説の切れ味</span>
              <span className="font-semibold">{score.hypothesis}/10</span>
            </li>
            <li className="flex justify-between">
              <span>示唆・インサイト</span>
              <span className="font-semibold">{score.insight}/10</span>
            </li>
            <li className="flex justify-between">
              <span>実現可能性</span>
              <span className="font-semibold">{score.practicality}/10</span>
            </li>
            <li className="flex justify-between">
              <span>伝え方・一貫性</span>
              <span className="font-semibold">{score.communication}/10</span>
            </li>
          </ul>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white/90 p-4 shadow-sm">
          <h3 className="mb-2 text-xs font-semibold text-slate-800">
            フィードバック（文章）
          </h3>
          {feedback ? (
            <div className="space-y-2 text-[11px] text-slate-700">
              <p>{feedback.summary}</p>
              <div>
                <p className="font-semibold text-slate-800 mb-1">◎ 良い点</p>
                <pre className="whitespace-pre-wrap">
                  {feedback.goodPoints}
                </pre>
              </div>
              <div>
                <p className="font-semibold text-slate-800 mb-1">
                  ▲ 改善ポイント
                </p>
                <pre className="whitespace-pre-wrap">
                  {feedback.improvePoints}
                </pre>
              </div>
              <div>
                <p className="font-semibold text-slate-800 mb-1">
                  ▶ 次にやると良いこと
                </p>
                <pre className="whitespace-pre-wrap">
                  {feedback.nextTraining}
                </pre>
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-slate-400">
              ここに AI からの良い点・改善点・次にやるべき練習の提案が表示されます。
            </p>
          )}
        </div>
      </aside>
    </div>
  );
};
