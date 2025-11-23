// src/config/THINKING_PATTERNS.ts

// ==============================
// 共通型
// ==============================

export type SkillKind = "fermi" | "case";

export type Lang = "ja" | "en";

export interface ScoringDimension {
  id: string;            // "reframing"
  label: string;         // "再定義"
  description: string;   // 評価観点の説明
  maxScore: number;      // 各10点
  weight: number;        // 合計点にかける重み（通常は1）
}

export interface StepDefinition {
  id: string;           // "reframe" | "decompose" ...
  label: string;        // "① 再定義"
  description: string;  // そのステップでやること
  order: number;        // 表示順
}

export interface ThinkingPatternBase {
  id: string;                 // "fermi_basic_v1"
  kind: SkillKind;            // "fermi" | "case"
  label: string;              // "フェルミ推定（基本型）"
  description: string;
  steps: StepDefinition[];
  scoring: ScoringDimension[]; // 5指標
}

// ==============================
// フェルミ推定パターン
// ==============================

export interface FermiFactorPayload {
  name: string;       // 要因名
  operator: "×" | "+"; // 掛け算 or 足し算
  assumption: string; // 仮定
  rationale: string;  // 仮定の根拠
  value: string;      // 計算に使った数値（丸め後）
}

export type FermiCategory = "daily" | "business" | "consulting";
export type FermiDifficulty = "easy" | "medium" | "hard";

export interface FermiEvalPayload {
  patternId: "fermi_basic_v1";
  kind: "fermi";
  question: string;       // お題
  category: FermiCategory;
  difficulty: FermiDifficulty;
  formula: string;        // 式
  unit: string;           // 単位
  factors: FermiFactorPayload[];
  resultText: string;     // 自分で書いた or 計算ボタン結果
  sanityComment: string;  // オーダーチェックコメント
}

export const FERMI_BASIC_PATTERN: ThinkingPatternBase = {
  id: "fermi_basic_v1",
  kind: "fermi",
  label: "フェルミ推定（基本型）",
  description:
    "「問題の再定義 → 要素分解 → 仮定と根拠 → 計算 → オーダーチェック」の型で思考プロセスを評価するフェルミ推定トレーナー。",
  steps: [
    {
      id: "reframe",
      label: "① 問題の再定義",
      description:
        "何を求めるのかを式で表現し、単位（年 / 月 / 人数 など）を揃える。",
      order: 1,
    },
    {
      id: "decompose",
      label: "② 要素分解（MECE）",
      description:
        "売上 = 客数 × 客単価 のように、2〜4個の要素に分解し、掛け算か足し算かを決める。",
      order: 2,
    },
    {
      id: "assumptions",
      label: "③ 仮定と根拠",
      description:
        "各要因ごとに「仮定」と「根拠（経験則・一般常識・比較など）」をペアで置く。",
      order: 3,
    },
    {
      id: "compute",
      label: "④ 計算",
      description:
        "1〜2桁に丸めた数値を使い、大きい数字から掛け算して概算を出す。",
      order: 4,
    },
    {
      id: "sanity",
      label: "⑤ オーダーチェック",
      description:
        "他国比較や実データ、常識と照らし合わせて、オーダー（桁感）が妥当か確認する。",
      order: 5,
    },
  ],
  scoring: [
    {
      id: "reframing",
      label: "再定義の明確さ",
      description:
        "問いを適切な式と単位に落とし込めているか。余計なものを含めず、本質を捉えた切り方になっているか。",
      maxScore: 10,
      weight: 1,
    },
    {
      id: "decomposition",
      label: "要素分解（MECE）",
      description:
        "過不足なく、重複少なく要因分解できているか。掛け算 / 足し算の設計が合理的か。",
      maxScore: 10,
      weight: 1,
    },
    {
      id: "assumptions",
      label: "仮定の質",
      description:
        "仮定が現実離れしていないか。根拠が明示されており、“なんとなく”で置いていないか。",
      maxScore: 10,
      weight: 1,
    },
    {
      id: "numbersSense",
      label: "数字感・丸め方",
      description:
        "1〜2桁で適切に丸めているか。大小感の理解があり、冗長な精度にこだわりすぎていないか。",
      maxScore: 10,
      weight: 1,
    },
    {
      id: "sanityCheck",
      label: "オーダー感",
      description:
        "最終結果が市場データ・類似事例・常識と大きく乖離していないか。自己ツッコミができているか。",
      maxScore: 10,
      weight: 1,
    },
  ],
};

// ==============================
// ケース面接パターン
// ==============================

export type CaseCategory = "growth" | "profit" | "newBiz" | "entry";
export type CaseIndustry = "retail" | "restaurant" | "tech" | "finance" | "other";

export interface CaseActionPayload {
  action: string;            // 打ち手
  kpi: string;               // KPI
  impact: "Low" | "Medium" | "High" | "";      // インパクト
  difficulty: "Low" | "Medium" | "High" | "";  // 難易度
}

export interface CaseEvalPayload {
  patternId: "case_basic_v1";
  kind: "case";
  caseId?: string;           // ガチャで出したケースID（あれば）
  category: CaseCategory;    // 成長 / 利益 / 新規 / 参入
  industry: CaseIndustry;
  client: string;
  question: string;          // お題
  goal: string;              // 最大化したいKPI
  initialHypothesis: string; // 初期仮説
  focusPoints: string[];     // 深掘りポイント
  dataNote: string;          // データからの示唆メモ
  updatedHypothesis: string; // 更新後の仮説
  actionPlans: CaseActionPayload[]; // 打ち手3つまで
}

export const CASE_BASIC_PATTERN: ThinkingPatternBase = {
  id: "case_basic_v1",
  kind: "case",
  label: "ケース面接（基本フロー）",
  description:
    "「ゴール再設定 → フレーム提示（仮説）→ 深掘りポイント → データで仮説更新 → 打ち手 & KPI」の黄金フローでケース思考を評価する。",
  steps: [
    {
      id: "goal",
      label: "① ゴール再設定",
      description:
        "クライアント・KPIを明確にし、「何を最大化するか」を一文で言い切る。",
      order: 1,
    },
    {
      id: "frame",
      label: "② フレーム提示（仮説ベース）",
      description:
        "成長 / 利益 / 新規 / 参入の型から選び、初期仮説と検証の柱を提示する。",
      order: 2,
    },
    {
      id: "deepDive",
      label: "③ 深掘りポイント",
      description:
        "インパクトの大きそうな要素から 2〜3 個に絞り、なぜそこを見るかを説明する。",
      order: 3,
    },
    {
      id: "updateHypothesis",
      label: "④ データで仮説更新",
      description:
        "与えられたデータから示唆を抜き出し、初期仮説をアップデートする。",
      order: 4,
    },
    {
      id: "solution",
      label: "⑤ 解決策（打ち手＋KPI）",
      description:
        "打ち手を 3 つ以内に絞り、それぞれに KPI・インパクト・難易度を紐づけて提案する。",
      order: 5,
    },
  ],
  scoring: [
    {
      id: "hypothesis",
      label: "仮説の切れ味",
      description:
        "クライアントの状況とゴールを踏まえた上で、筋の良い仮説を立てられているか。",
      maxScore: 10,
      weight: 1,
    },
    {
      id: "structure",
      label: "構造化（フレーム）",
      description:
        "MECEかつ論点漏れが少ないフレームになっているか。優先順位が明確か。",
      maxScore: 10,
      weight: 1,
    },
    {
      id: "insightFromData",
      label: "データからの示唆",
      description:
        "与えられた数字や情報から、本質的なインサイトを引き出せているか。",
      maxScore: 10,
      weight: 1,
    },
    {
      id: "solutionQuality",
      label: "打ち手の質",
      description:
        "打ち手がゴールと整合的かつ具体的か。KPIと直結しているか。",
      maxScore: 10,
      weight: 1,
    },
    {
      id: "feasibility",
      label: "実現可能性",
      description:
        "現実的なリソース・制約を踏まえた上で、実行可能な提案になっているか。",
      maxScore: 10,
      weight: 1,
    },
  ],
};

// ==============================
// パターン一覧（UIやAPIで使う用）
// ==============================

export const THINKING_PATTERNS: ThinkingPatternBase[] = [
  FERMI_BASIC_PATTERN,
  CASE_BASIC_PATTERN,
];

// ==============================
// Eval API に投げるときの共通 Union 型
// ==============================

export type MentorEvalPayload = FermiEvalPayload | CaseEvalPayload;
