"use client";

import React, { useState } from "react";

type Step = 1 | 2 | 3 | 4 | 5;

type Scores = {
  clarity: number; // 指示の具体性
  structure: number; // 思考の構造化
  reproducibility: number; // 再現性
  strategy: number; // AI活用戦略
};

type AiTypeKey = "sensory" | "overSpec" | "logical" | "dependent" | "strategic";

type AiTypeProfile = {
  key: AiTypeKey;
  label: string;
  subtitle: string;
  description: string;
  strengths: string[];
  weaknesses: string[];
};

type ScenarioKey = "marketing" | "sales" | "consulting" | "backoffice" | "student";

const SCENARIOS: Record<
  ScenarioKey,
  {
    label: string;
    step1: { role: string; request: string };
    step2: { detail: string[] };
    step3: { theme: string; hint: string };
    step4: { tasks: string[] };
    step5: { baseText: string };
  }
> = {
  marketing: {
    label: "マーケティング",
    step1: {
      role: "マーケティング担当",
      request: "この商品のSNS投稿を作ってほしい",
    },
    step2: {
      detail: [
        "商品：20代女性向けのスキンケアアイテム",
        "媒体：Instagram投稿",
        "目的：ブランドの認知拡大",
        "文字数：150字以内",
        "トーン：やわらかく、親しみやすい",
      ],
    },
    step3: {
      theme: "新サービスの売上が伸び悩んでいます",
      hint: "認知・ターゲット・価格・訴求内容・競合…など",
    },
    step4: {
      tasks: [
        "① キャンペーン用LPの構成案づくり",
        "② SNS広告用テキストの改善",
        "③ 広告配信データの集計・グラフ化",
        "④ マーケティング戦略全体の設計",
      ],
    },
    step5: {
      baseText:
        "こちらの商品は非常に高品質で、多くのお客様にご満足いただいております。ぜひご検討ください。",
    },
  },

  sales: {
    label: "営業・セールス",
    step1: {
      role: "法人営業担当",
      request: "このサービスの提案メールを書いてほしい",
    },
    step2: {
      detail: [
        "相手：IT企業の営業部長",
        "目的：オンライン商談のアポイント獲得",
        "文字数：300字以内",
        "トーン：丁寧だがフレンドリー",
        "構成：①導入 ②相手の状況への共感 ③提案の概要 ④次のアクション",
      ],
    },
    step3: {
      theme: "既存顧客へのクロスセルが伸びません",
      hint: "顧客セグメント・提案内容・タイミング・インセンティブ…など",
    },
    step4: {
      tasks: [
        "① 提案資料のたたき台作成",
        "② 初回アプローチメールの作成",
        "③ 商談ログからの議事録要約",
        "④ 次回商談の戦略設計",
      ],
    },
    step5: {
      baseText:
        "弊社サービスは多くのお客様にご利用いただいており、業務効率化に大きく貢献しています。ぜひ一度ご検討ください。",
    },
  },

  consulting: {
    label: "コンサル・戦略",
    step1: {
      role: "コンサルタント",
      request: "クライアント向けの課題整理メモをつくってほしい",
    },
    step2: {
      detail: [
        "テーマ：新規事業立ち上げ",
        "前提：既存顧客基盤を活かしたBtoBサービス",
        "目的：初回提案のための論点整理",
        "形式：箇条書きのメモ",
      ],
    },
    step3: {
      theme: "クライアントの既存事業の利益率が低下しています",
      hint: "売上・コスト構造・チャネル・組織…など",
    },
    step4: {
      tasks: [
        "① 現状整理スライドのドラフト作成",
        "② インタビュー議事録の要約",
        "③ データ分析方針の整理",
        "④ 提案ストーリーラインの設計",
      ],
    },
    step5: {
      baseText:
        "本提案は御社の事業成長に大きく寄与する可能性があります。ご検討のほど何卒よろしくお願い申し上げます。",
    },
  },

  backoffice: {
    label: "バックオフィス・社内業務",
    step1: {
      role: "総務・バックオフィス担当",
      request: "社内向けのお知らせ文をつくってほしい",
    },
    step2: {
      detail: [
        "対象：全社員",
        "テーマ：新しいリモートワークルールのお知らせ",
        "トーン：丁寧・わかりやすく",
        "含めたい内容：背景・変更内容・開始日・問合せ先",
      ],
    },
    step3: {
      theme: "社内の情報共有がうまくいっていません",
      hint: "ツール・ルール・頻度・フォーマット…など",
    },
    step4: {
      tasks: [
        "① 社内規程のドラフト作成",
        "② 社内アンケート結果の要約",
        "③ 会議議事録の作成",
        "④ 社内コミュニケーション改善施策の検討",
      ],
    },
    step5: {
      baseText:
        "このたび社内制度を一部変更することになりました。社員の皆さまにはご理解とご協力を賜りますようお願い申し上げます。",
    },
  },

  student: {
    label: "就活・学生",
    step1: {
      role: "大学生",
      request: "ゼミのレポートのたたき台をつくってほしい",
    },
    step2: {
      detail: [
        "課題：日本企業のガバナンス改革についてのレポート",
        "文字数：2000字",
        "必要な要素：背景・現状・課題・自分の考え",
        "トーン：レポート風で、です・ます調",
      ],
    },
    step3: {
      theme: "就活のESがなかなか通過しません",
      hint: "自己PR内容・企業とのフィット・文字量・構成…など",
    },
    step4: {
      tasks: [
        "① ESのたたき台作成",
        "② ガクチカのエピソード要約",
        "③ 面接想定質問リストの作成",
        "④ キャリアプランの深堀り",
      ],
    },
    step5: {
      baseText:
        "私は学生時代、様々な活動に取り組んできました。この経験を活かして、御社でも成長していきたいと考えています。",
    },
  },
};

const INITIAL_SCORES: Scores = {
  clarity: 0,
  structure: 0,
  reproducibility: 0,
  strategy: 0,
};

const AI_TYPE_PROFILES: Record<AiTypeKey, AiTypeProfile> = {
  sensory: {
    key: "sensory",
    label: "感覚型オーダータイプ",
    subtitle: "ふんわり直感でAIにお願いするタイプ",
    description:
      "発想が柔軟で、直感的にAIを使える一方で、「誰に・何を・どんなトーンで・どのくらい」の条件が曖昧になりやすい傾向があります。",
    strengths: ["表現力やアイデアが豊か", "文章のニュアンスをつけるのが得意", "AIを気軽に使える"],
    weaknesses: [
      "条件が曖昧で、AIが迷いやすい指示になりがち",
      "毎回アウトプットの質がばらつきやすい",
      "目的やゴールがはっきり書かれないことがある",
    ],
  },
  overSpec: {
    key: "overSpec",
    label: "指示過多コントローラータイプ",
    subtitle: "条件を詰め込みすぎてAIを縛りがちなタイプ",
    description:
      "情報量が多く、丁寧に条件を伝えられる一方で、指示が長くなりすぎてAIも人も読みづらくなりがちな傾向があります。",
    strengths: ["情報をたくさん盛り込める", "抜け漏れを減らすのが得意", "真面目に準備できる"],
    weaknesses: [
      "指示文が長すぎて意図が伝わりにくくなる",
      "本当に重要な条件がどれか分かりにくくなる",
      "人に共有したときに再利用しづらい",
    ],
  },
  logical: {
    key: "logical",
    label: "論理構造マスタータイプ",
    subtitle: "論点や要素をきれいに整理できるタイプ",
    description:
      "問題を分解して整理する力が高く、AIに渡す前の“人間側の思考”がしっかりしています。さらにプロンプトの具体性と再現性が高まると最強です。",
    strengths: [
      "問題を分解・整理して考えられる",
      "箇条書きで整理するのが得意",
      "AIへの渡し方次第で一気に精度が上がるポテンシャル",
    ],
    weaknesses: [
      "構造化に時間をかけすぎてしまうことがある",
      "条件やトーンなどの細部をAIに伝えそびれることがある",
    ],
  },
  dependent: {
    key: "dependent",
    label: "丸投げディペンデントタイプ",
    subtitle: "とりあえずAIに聞いてみたくなるタイプ",
    description:
      "AIを頼ること自体はとても良いことですが、「何をしたいのか」「どこまで任せるのか」が曖昧なまま丸投げしがちな傾向があります。",
    strengths: ["AIを日常的に使おうとする意欲がある", "一人で抱え込まずに外部に頼れる", "スピード重視で動ける"],
    weaknesses: [
      "AIの出力に引っ張られやすい",
      "自分の意図や考えが出力に反映されにくい",
      "“とりあえず聞く”で終わりがち",
    ],
  },
  strategic: {
    key: "strategic",
    label: "戦略的コ・パイロットタイプ",
    subtitle: "AIと人間の役割分担を意識できるタイプ",
    description:
      "AIを“部下”や“共同作業者”として捉え、どこまで任せてどこを自分でやるかを考えられるタイプです。実務の中でAIを最大限活かしやすいスタイルです。",
    strengths: [
      "作業のどこにAIを入れるか考えられる",
      "AIに任せる部分と自分がやる部分を分けられる",
      "ワークフロー全体で効率化を設計しやすい",
    ],
    weaknesses: [
      "詳細なプロンプト設計をサボりがちになることがある",
      "慣れてくるとチェックを省略してしまうリスク",
    ],
  },
};

const QUESTION_TITLES: Record<Step, string> = {
  1: "問題①：プロンプト設計（基本）",
  2: "問題②：プロンプト設計（応用）",
  3: "問題③：思考構造化",
  4: "問題④：AI活用判断",
  5: "問題⑤：AI出力の編集",
};

export default function MentorAiIndexPage() {
  const [step, setStep] = useState<Step>(1);
  const [scenario, setScenario] = useState<ScenarioKey>("marketing");
  const [answers, setAnswers] = useState<Record<Step, string>>({
    1: "",
    2: "",
    3: "",
    4: "",
    5: "",
  });
  const [scores, setScores] = useState<Scores>(INITIAL_SCORES);
  const [aiType, setAiType] = useState<AiTypeProfile | null>(null);
  const [isFinished, setIsFinished] = useState(false);

  const handleChange = (s: Step, value: string) => {
    setAnswers((prev) => ({ ...prev, [s]: value }));
  };

  const handleNext = () => {
    if (step === 5) {
      const newScores = evaluateScores(answers);
      const typeKey = detectAiType(answers, newScores);
      setScores(newScores);
      setAiType(AI_TYPE_PROFILES[typeKey]);
      setIsFinished(true);
      return;
    }
    setStep((prev) => (prev + 1) as Step);
  };

  const handlePrev = () => {
    if (step === 1) return;
    setStep((prev) => (prev - 1) as Step);
  };

  const handleRestart = () => {
    setStep(1);
    setAnswers({ 1: "", 2: "", 3: "", 4: "", 5: "" });
    setScores(INITIAL_SCORES);
    setAiType(null);
    setIsFinished(false);
  };

  const handleScenarioChange = (key: ScenarioKey) => {
    setScenario(key);
    // シナリオ変えたらリセットして1問目から
    setStep(1);
    setAnswers({ 1: "", 2: "", 3: "", 4: "", 5: "" });
    setScores(INITIAL_SCORES);
    setAiType(null);
    setIsFinished(false);
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-4 py-10">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-500">
          Mentor.AI Index β
        </p>
        <h1 className="text-2xl font-semibold text-slate-900">
          AI思考力トレーニング
        </h1>
        <p className="text-sm text-slate-600">
          AIとの対話力・指示力・編集力を、5つの実践問題を通して静かに可視化します。
        </p>
      </header>

      {!isFinished ? (
        <>
          {/* Scenario selector */}
          <div className="flex flex-wrap gap-2 text-[11px]">
            {(Object.keys(SCENARIOS) as ScenarioKey[]).map((key) => {
              const s = SCENARIOS[key];
              const active = scenario === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleScenarioChange(key)}
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

          {/* Progress */}
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
            <div>
              Step {step} / 5
            </div>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <span
                  key={n}
                  className={`h-1.5 w-8 rounded-full ${
                    n <= step ? "bg-sky-500" : "bg-slate-200"
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Question card */}
          <section className="rounded-2xl border border-slate-100 bg-white/80 p-5 shadow-sm shadow-slate-100 backdrop-blur">
            <h2 className="mb-3 text-sm font-semibold text-slate-800">
              {QUESTION_TITLES[step]}
            </h2>
            <QuestionBody step={step} scenario={scenario} />

            <div className="mt-4">
              <textarea
                className="h-40 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none ring-sky-200 focus:bg-white focus:ring-2"
                value={answers[step]}
                onChange={(e) => handleChange(step, e.target.value)}
                placeholder="ここにあなたの考えやプロンプトを書いてください。"
              />
              <p className="mt-1 text-right text-[11px] text-slate-400">
                {answers[step].length}文字
              </p>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <button
                type="button"
                onClick={handlePrev}
                disabled={step === 1}
                className="text-xs text-slate-400 hover:text-slate-600 disabled:cursor-not-allowed disabled:text-slate-300"
              >
                ← 前の問題へ
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="inline-flex items-center gap-2 rounded-full bg-sky-500 px-4 py-1.5 text-xs font-medium text-white shadow-sm shadow-sky-200 hover:bg-sky-600"
              >
                {step === 5 ? "結果を見る" : "次へ進む →"}
              </button>
            </div>
          </section>

          {/* Hint / philosophy */}
          <section className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-4 text-[11px] text-slate-500">
            <p className="font-medium text-slate-700">ヒント</p>
            <p className="mt-1">
              正解・不正解を当てるテストではありません。
              「どう考えてAIに任せるか」というあなたの思考パターンを、そのまま書いて大丈夫です。
            </p>
          </section>
        </>
      ) : (
        <ResultSection
          answers={answers}
          scores={scores}
          aiType={aiType}
          onRestart={handleRestart}
        />
      )}
    </main>
  );
}

// 質問本文（シナリオ別）
function QuestionBody({ step, scenario }: { step: Step; scenario: ScenarioKey }) {
  const sc = SCENARIOS[scenario];

  if (step === 1) {
    return (
      <div className="space-y-2 text-sm text-slate-700">
        <p className="font-medium text-slate-800">
          あなたは{sc.step1.role}です。
        </p>
        <p>
          上司や依頼者から
          <span className="rounded bg-slate-100 px-1 py-0.5 text-[11px]">
            「{sc.step1.request}」
          </span>
          とだけ言われました。
        </p>
        <p>
          この依頼を、AI（例：ChatGPT）に伝えるとしたら、どのような指示（プロンプト）を書きますか？
        </p>
        <ul className="mt-2 list-disc pl-5 text-[11px] text-slate-500">
          <li>誰向けか・目的・トーン・文字数などを含めてもOKです。</li>
          <li>ふつうに日本語で書いて大丈夫です。</li>
        </ul>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="space-y-2 text-sm text-slate-700">
        <p className="font-medium text-slate-800">
          もう少し具体的なケースで、プロンプトを考えてみましょう。
        </p>
        <p>以下の条件をすべて踏まえたうえで、AIに出す指示文を書いてください。</p>
        <ul className="mt-2 list-disc pl-5 text-[11px] text-slate-600">
          {sc.step2.detail.map((d, i) => (
            <li key={i}>{d}</li>
          ))}
        </ul>
        <p className="mt-2 text-[11px] text-slate-500">
          ※「誰に」「何を」「どんな雰囲気で」「どのくらい」という要素を、どうAIに伝えるかを意識してみてください。
        </p>
      </div>
    );
  }

  if (step === 3) {
    return (
      <div className="space-y-2 text-sm text-slate-700">
        <p className="font-medium text-slate-800">思考の構造化の問題です。</p>
        <p className="text-sm">
          次の課題について、あなたならどのような要素に分解して考えますか？
        </p>
        <p className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-700">
          「{sc.step3.theme}」
        </p>
        <p className="text-xs text-slate-600">
          思いつく要因や観点を
          <span className="font-semibold">箇条書き</span>
          で書いてください。
        </p>
        <ul className="mt-1 list-disc pl-5 text-[11px] text-slate-500">
          <li>例：{sc.step3.hint}</li>
          <li>正解はないので、「自分ならこう分ける」という形でOKです。</li>
        </ul>
      </div>
    );
  }

  if (step === 4) {
    return (
      <div className="space-y-2 text-sm text-slate-700">
        <p className="font-medium text-slate-800">AIに任せる／任せないの判断問題です。</p>
        <p>次の4つの作業を見て、</p>
        <ul className="mt-1 list-disc pl-5 text-xs text-slate-700">
          <li>AIに任せたい作業</li>
          <li>人間（自分）が行いたい作業</li>
        </ul>
        <p className="text-xs text-slate-600">に分けて、それぞれ理由も書いてください。</p>
        <ul className="mt-2 list-disc pl-5 text-[11px] text-slate-600">
          {sc.step4.tasks.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
        <p className="mt-2 text-[11px] text-slate-500">
          例）AIに任せたい：③（理由：数字処理が多く、人間より早いから） など
        </p>
      </div>
    );
  }

  // step === 5
  return (
    <div className="space-y-2 text-sm text-slate-700">
      <p className="font-medium text-slate-800">AI出力の「編集力」を見る問題です。</p>
      <p>次のようなAI生成文があったとします：</p>
      <p className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-700">
        「{sc.step5.baseText}」
      </p>
      <p className="text-xs text-slate-600">
        この文章を、
        <span className="font-semibold">「あなたらしい表現」かつ「より魅力的」</span>
        だと思う形に書き直してください。
      </p>
      <ul className="mt-1 list-disc pl-5 text-[11px] text-slate-500">
        <li>誰に話しているのか（ターゲット）</li>
        <li>どんなトーンにしたいか（丁寧／カジュアル など）</li>
        <li>何を一番伝えたいか</li>
      </ul>
    </div>
  );
}

// スコアリングロジック（かなりラフなヒューリスティック）
function evaluateScores(answers: Record<Step, string>): Scores {
  const a1 = answers[1] ?? "";
  const a2 = answers[2] ?? "";
  const a3 = answers[3] ?? "";
  const a4 = answers[4] ?? "";
  const a5 = answers[5] ?? "";

  // 文字数ベースのざっくり判定
  const len1 = a1.length;
  const len2 = a2.length;
  const len3 = a3.length;
  const len4 = a4.length;
  // const len5 = a5.length; // 今は未使用だが残しておく

  // clarity: 指示文の具体性（1〜5）
  let clarity = 1;
  const hasTargetWords = /(ターゲット|対象|20代|誰に|相手)/.test(a1 + a2);
  const hasToneWords = /(トーン|雰囲気|カジュアル|丁寧|やわらかく)/.test(a1 + a2);
  const hasLengthWords = /(文字|字|何字|文字数)/.test(a1 + a2);
  const hasPurposeWords = /(目的|ゴール|狙い|認知|売上|アポイント|利益)/.test(a1 + a2);

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

  // structure: 箇条書き・行分割の量（1〜5）
  const lines3 = a3.split(/\n/).filter((l) => l.trim().length > 0).length;
  let structure = 1;
  if (lines3 >= 2) structure = 2;
  if (lines3 >= 3) structure = 3;
  if (lines3 >= 5) structure = 4;
  if (lines3 >= 7) structure = 5;

  // reproducibility: 再現性（条件の数・具体度）（1〜5）
  let reproducibility = 1;
  const keyCount =
    (hasTargetWords ? 1 : 0) +
    (hasToneWords ? 1 : 0) +
    (hasLengthWords ? 1 : 0) +
    (hasPurposeWords ? 1 : 0);
  if (keyCount === 0) reproducibility = 1;
  else if (keyCount === 1) reproducibility = 2;
  else if (keyCount === 2) reproducibility = 3;
  else if (keyCount === 3) reproducibility = 4;
  else reproducibility = 5;

  // strategy: AIへの役割分担の考え方（1〜5）
  let strategy = 1;
  const hasSplit =
    /AIに任せたい|AIに任せる|人間がやる|自分が/.test(a4) ||
    /(①|②|③|④)/.test(a4);
  const mentionsReason = /(理由|から|ため)/.test(a4);
  if (len4 < 20) strategy = 1;
  else if (!hasSplit) strategy = 2;
  else if (hasSplit && !mentionsReason) strategy = 3;
  else if (hasSplit && mentionsReason && len4 > 80) strategy = 4;
  else strategy = 5;

  return {
    clarity,
    structure,
    reproducibility,
    strategy,
  };
}

// タイプ判定ロジック（超ざっくりルールベース）
function detectAiType(answers: Record<Step, string>, scores: Scores): AiTypeKey {
  const a1 = answers[1] ?? "";
  const a2 = answers[2] ?? "";
  const a3 = answers[3] ?? "";
  const a4 = answers[4] ?? "";
  // const a5 = answers[5] ?? "";

  const totalPromptLen = (a1 + a2).length;

  const saysAllToAi =
    /全部AIに任せ|AIに全部|とりあえずAI/.test(a4 + a1 + a2) ||
    /なんでもAI/.test(a4);

  const hasManyConditions =
    totalPromptLen > 400 &&
    /(条件|ただし|ただ、|なお|※)/.test(a1 + a2);

  const quiteStructured =
    scores.structure >= 4 && /(・|-|①|②)/.test(a3);

  const mentionsSplit =
    /(AIに任せ|人間が|自分がやる|役割分担)/.test(a4);

  if (saysAllToAi) {
    return "dependent";
  }

  if (mentionsSplit && scores.strategy >= 4) {
    return "strategic";
  }

  if (hasManyConditions && scores.clarity >= 3) {
    return "overSpec";
  }

  if (quiteStructured && scores.structure >= 4) {
    return "logical";
  }

  // デフォルトは感覚型
  return "sensory";
}

// 結果表示セクション
function ResultSection({
  answers,
  scores,
  aiType,
  onRestart,
}: {
  answers: Record<Step, string>;
  scores: Scores;
  aiType: AiTypeProfile | null;
  onRestart: () => void;
}) {
  return (
    <>
      <section className="rounded-2xl border border-sky-100 bg-white/90 p-6 shadow-sm shadow-sky-100 backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-500">
          Result
        </p>
        <h2 className="mt-1 text-xl font-semibold text-slate-900">
          あなたのAI思考タイプ
        </h2>

        {aiType ? (
          <div className="mt-4 space-y-3">
            <div>
              <p className="inline-flex items-center rounded-full bg-sky-50 px-3 py-1 text-[11px] font-medium text-sky-600">
                {aiType.label}
              </p>
              <p className="mt-2 text-xs font-medium text-slate-700">
                {aiType.subtitle}
              </p>
              <p className="mt-1 text-xs text-slate-600">{aiType.description}</p>
            </div>

            <div className="mt-3 grid gap-3 text-xs text-slate-700 md:grid-cols-2">
              <div className="rounded-xl bg-sky-50/80 p-3">
                <p className="text-[11px] font-semibold text-sky-700">Strengths / 強み</p>
                <ul className="mt-1 list-disc pl-4 text-[11px] text-sky-900">
                  {aiType.strengths.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl bg-rose-50/80 p-3">
                <p className="text-[11px] font-semibold text-rose-700">
                  Weaknesses / 課題になりやすい点
                </p>
                <ul className="mt-1 list-disc pl-4 text-[11px] text-rose-900">
                  {aiType.weaknesses.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-xs text-slate-500">
            タイプの判定に失敗しましたが、スコアは参考にできます。
          </p>
        )}

        <div className="mt-6 border-t border-slate-100 pt-4">
          <p className="text-[11px] font-semibold text-slate-600">
            あなたのAI活用スコア（参考値）
          </p>
          <div className="mt-2 grid gap-2 text-[11px] text-slate-700 md:grid-cols-2">
            <ScoreBar label="指示の具体性（Clarity）" value={scores.clarity} />
            <ScoreBar label="思考の構造化（Structure）" value={scores.structure} />
            <ScoreBar
              label="再現性のある指示（Reproducibility）"
              value={scores.reproducibility}
            />
            <ScoreBar label="AI活用戦略（Strategy）" value={scores.strategy} />
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between">
          <button
            type="button"
            onClick={onRestart}
            className="text-[11px] text-slate-400 hover:text-slate-700"
          >
            もう一度やってみる →
          </button>
          <p className="text-[10px] text-slate-400">
            ※ この診断はあくまで“入口”用のラフな評価です。深い評価は今後アップデート予定。
          </p>
        </div>
      </section>

      {/* 回答の振り返り（自分用ログ） */}
      <section className="rounded-2xl border border-slate-100 bg-slate-50/70 p-5 text-[11px] text-slate-600">
        <p className="mb-2 text-[11px] font-semibold text-slate-700">
          あなたの回答ログ（自分だけの振り返り用）
        </p>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((s) => (
            <div key={s} className="rounded-xl bg-white/80 p-3">
              <p className="mb-1 text-[10px] font-semibold text-slate-500">
                {QUESTION_TITLES[s as Step]}
              </p>
              <p className="whitespace-pre-wrap text-[11px] text-slate-700">
                {answers[s as Step] || "（未入力）"}
              </p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const max = 5;
  const stars = Array.from({ length: max }, (_, i) => i < value);

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center justify-between">
        <span>{label}</span>
        <span className="tabular-nums text-[10px] text-slate-400">
          {value} / {max}
        </span>
      </div>
      <div className="flex gap-0.5">
        {stars.map((on, idx) => (
          <span
            key={idx}
            className={on ? "text-amber-400" : "text-slate-300"}
          >
            ★
          </span>
        ))}
      </div>
    </div>
  );
}
