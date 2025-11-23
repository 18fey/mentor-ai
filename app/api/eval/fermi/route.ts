// app/api/eval/fermi/route.ts
import { NextResponse } from "next/server";

type FermiFactor = {
  name: string;
  assumption: string;
  rationale: string;
  value: string;
};

export async function POST(req: Request) {
  const body = await req.json();

  const {
    question,
    formula,
    unit,
    factors = [],
    sanityComment,
    problemId,
    category,
    difficulty,
  } = body as {
    question: string;
    formula: string;
    unit: string;
    factors: FermiFactor[];
    sanityComment: string;
    problemId?: string | null;
    category?: string;
    difficulty?: string;
  };

  // ① とりあえずダミースコア（あとで OpenAI に差し替えればOK）
  const dummyScore = {
    reframing: 8,
    decomposition: 7,
    assumptions: 6,
    numbersSense: 7,
    sanityCheck: 5,
  };

  const total =
    dummyScore.reframing +
    dummyScore.decomposition +
    dummyScore.assumptions +
    dummyScore.numbersSense +
    dummyScore.sanityCheck;

  // ② ざっくりフィードバックを組み立てる（テンプレ）
  const factorLines =
    factors && factors.length > 0
      ? factors
          .map((f, idx) => {
            const a = f.assumption || "（仮定未入力）";
            const r = f.rationale || "（根拠未入力）";
            return `・Factor${idx + 1}「${f.name || "未設定"}」: ${a} ／ 根拠: ${r}`;
          })
          .join("\n")
      : "・Factor が設定されていません。最低 2〜3 個は分解してみましょう。";

  const sampleFormula = formula || "人口 × 割合 × 頻度 × 単価";

  const sampleAnswer = [
    `【結論】`,
    `${question || "この量"} は、おおよそ 1桁〜2桁の誤差で妥当なオーダーと考えられる。`,
    "",
    `【考え方】`,
    `まず「${sampleFormula}」という形で式を置く。`,
    "",
    `【主な仮定】`,
    factorLines,
    "",
    `【計算イメージ】`,
    `各要因を 1〜2桁に丸めて掛け合わせ、${unit || "適切な単位"} に揃える。`,
    "",
    `【オーダーチェック】`,
    sanityComment ||
      "実際の統計値（市場規模や人口など）と比べて、1〜2桁以内に収まっているかざっくり確認する。",
  ].join("\n");

  const feedback = {
    summary:
      "分解と再定義は良いので、仮定の根拠とオーダーチェックをもう一段だけ丁寧にすると、コンサル面接レベルでもかなり強い答案になります。",
    strengths: [
      "問題を式に落とし込めている点は良いです。",
      "複数の要因に分解できているので、大きな漏れは少ないです。",
    ],
    weaknesses: [
      "一部の仮定について、根拠の説明が薄くなっています。",
      "最後のオーダーチェック（常識・実データとの比較）がやや弱いです。",
    ],
    advice:
      "各 Factor ごとに『なぜその数字なのか？』を 1行で書く習慣をつけると、面接官からの追加質問にも耐えられる答案になります。",
    sampleAnswer,
    totalScore: total,
  };

  // ※ Supabase 保存はあとで足してもOK。今はフロントに返すだけ。
  return NextResponse.json({
    score: dummyScore,
    feedback,
  });
}

