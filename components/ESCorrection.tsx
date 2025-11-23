// src/components/ESCorrection.tsx
"use client";

import React, { useState, useEffect } from "react";

type QuestionType =
  | "self_pr"
  | "gakuchika"
  | "why_company"
  | "why_industry"
  | "other";

type EsScore = {
  structure: number;
  logic: number;
  clarity: number;
  companyFit: number;
  lengthFit: number;
};

type EsFeedback = {
  summary: string;
  strengths: string[];
  improvements: string[];
  checklist: string[];
  sampleStructure: string;
};

const QUESTION_LABEL: Record<QuestionType, string> = {
  self_pr: "自己PR",
  gakuchika: "学生時代に力を入れたこと",
  why_company: "志望動機（企業）",
  why_industry: "志望動機（業界）",
  other: "その他",
};

// 🔗 ストーリーカード型（/api/story-cards のレスポンスをフロント用に整形したもの）
type StoryCard = {
  id: string;
  topicType:
    | "gakuchika"
    | "self_pr"
    | "why_company"
    | "why_industry"
    | "self_intro"
    | "general"
    | string;
  title: string;
  star: {
    situation: string;
    task: string;
    action: string;
    result: string;
  };
  learnings: string;
  axes: string[];
  isSensitive: boolean;
  createdAt: string;
};

const DEMO_USER_ID = "demo-user";

export const ESCorrection: React.FC = () => {
  const [company, setCompany] = useState("");
  const [qType, setQType] = useState<QuestionType>("self_pr");
  const [limit, setLimit] = useState<number>(400);
  const [text, setText] = useState("");

  const [score, setScore] = useState<EsScore | null>(null);
  const [feedback, setFeedback] = useState<EsFeedback | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const charCount = text.trim().length;

  // 📚 ストーリーカード一覧
  const [storyCards, setStoryCards] = useState<StoryCard[]>([]);
  const [cardsLoading, setCardsLoading] = useState(false);
  const [cardsError, setCardsError] = useState<string | null>(null);

  // 初回ロードでストーリーカード取得（一般面接AIと同じ /api/story-cards を利用）
  useEffect(() => {
    const fetchCards = async () => {
      setCardsLoading(true);
      setCardsError(null);
      try {
        const res = await fetch(
          `/api/story-cards?userId=${encodeURIComponent(DEMO_USER_ID)}`
        );
        if (!res.ok) {
          const body = await res.text();
          console.error("ESCorrection story-cards error:", res.status, body);
          setCardsError("ストーリーカードの取得に失敗しました。");
          return;
        }
        const data = await res.json();
        const rows: any[] = Array.isArray(data.storyCards)
          ? data.storyCards
          : [];
　　　　　const mapped: StoryCard[] = rows.map((row) => ({
  id: row.id,
  topicType: row.type,
  title: row.title,
  star: row.star,             // 👈 jsonbそのまま
  learnings: row.learnings,
  axes: row.axes_link ?? [],
  isSensitive: row.is_sensitive,
  createdAt: row.created_at,
}));


        setStoryCards(mapped);
      } catch (e) {
        console.error(e);
        setCardsError("ネットワークエラーでカードを取得できませんでした。");
      } finally {
        setCardsLoading(false);
      }
    };

    fetchCards();
  }, []);

  // 🔧 topicType → QuestionType のマッピング
  const mapTopicToQuestionType = (
    topic: StoryCard["topicType"]
  ): QuestionType => {
    if (topic === "gakuchika") return "gakuchika";
    if (topic === "self_pr" || topic === "self_intro") return "self_pr";
    if (topic === "why_company") return "why_company";
    if (topic === "why_industry") return "why_industry";
    return "other";
  };

  // 🔧 topicType → ラベル（カード表示用）
  const topicLabelFromCard = (topic: StoryCard["topicType"]): string => {
    const qt = mapTopicToQuestionType(topic);
    return QUESTION_LABEL[qt];
  };

  // ⭐ ストーリーカードから ES ひな型を組み立て
  const buildTemplateFromCard = (card: StoryCard): string => {
    const lines: string[] = [];

    // 1. 結論ブロック
    lines.push("【結論】");
    if (card.learnings) {
      lines.push(card.learnings.trim());
    } else {
      lines.push("（ここにこの経験から伝えたい結論・強みを書きます）");
    }

    // 2. S / T / A / R
    lines.push("");
    lines.push("【状況（S）】");
    lines.push(card.star.situation || "（いつ・どこで・誰と・どんな状況だったか）");

    lines.push("");
    lines.push("【課題・役割（T）】");
    lines.push(card.star.task || "（自分の役割や目標、抱えていた課題など）");

    lines.push("");
    lines.push("【行動（A）】");
    lines.push(card.star.action || "（具体的に取った行動・工夫・試行錯誤）");

    lines.push("");
    lines.push("【結果（R）】");
    lines.push(card.star.result || "（数字・事実ベースでどう変わったか）");

    // 3. 学び
    lines.push("");
    lines.push("【この経験から得たこと】");
    lines.push(
      card.learnings ||
        "（この経験から得た学び・強み・今後にどう活きるかを書きます）"
    );

    return lines.join("\n");
  };

  // 🧩 ストーリーカードをクリックしたとき：ES本文と設問タイプをセット
  const handleApplyCardToEs = (card: StoryCard) => {
    const template = buildTemplateFromCard(card);
    setText(template);
    setQType(mapTopicToQuestionType(card.topicType));
  };

  const handleEvaluate = async () => {
    if (!text.trim()) return;

    setIsEvaluating(true);
    setErrorMessage(null);
    setScore(null);
    setFeedback(null);

    try {
      const res = await fetch("/api/es/eval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          company,
          qType,
          limit,
        }),
      });

      let data: any = null;
      try {
        data = await res.json();
      } catch {
        throw new Error("Invalid JSON response");
      }

      if (!res.ok || !data?.score || !data?.feedback) {
        console.error("ES eval error:", data);
        setErrorMessage(
          "AI添削に失敗しました。時間をおいて再度お試しください。"
        );
      } else {
        setScore(data.score as EsScore);
        setFeedback(data.feedback as EsFeedback);
      }
    } catch (e) {
      console.error(e);
      setErrorMessage("ネットワークエラーが発生しました。");
    } finally {
      setIsEvaluating(false);
    }
  };

  return (
    <div className="flex h-full gap-6">
      {/* 左：入力エリア */}
      <div className="flex-1 space-y-6 overflow-y-auto pr-2">
        {/* ヘッダー */}
        <section className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
          <h1 className="mb-1 text-sm font-semibold text-slate-900">
            ES添削AI（構成・ロジックチェック）
          </h1>
          <p className="text-[11px] text-slate-600">
            貼り付けたESに対して、構成・ロジック・文字数・企業フィットなどを
            OpenAI API 経由で採点します。
          </p>
          <p className="mt-2 text-[10px] text-slate-500">
            ※ 健康状態・家族構成・宗教・政治などのセンシティブな内容は、
            できるだけ具体的に書きすぎないようにしてください。
          </p>
        </section>

        {/* メタ情報 */}
        <section className="space-y-3 rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-3 text-xs md:grid-cols-3">
            <div>
              <label className="mb-1 block text-[11px] text-slate-500">
                企業名（任意）
              </label>
              <input
                className="w-full rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-sky-300"
                placeholder="例：三井物産 / マッキンゼー など"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-slate-500">
                設問の種類
              </label>
              <select
                className="w-full rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-sky-300"
                value={qType}
                onChange={(e) => setQType(e.target.value as QuestionType)}
              >
                <option value="self_pr">{QUESTION_LABEL.self_pr}</option>
                <option value="gakuchika">{QUESTION_LABEL.gakuchika}</option>
                <option value="why_company">{QUESTION_LABEL.why_company}</option>
                <option value="why_industry">
                  {QUESTION_LABEL.why_industry}
                </option>
                <option value="other">{QUESTION_LABEL.other}</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-slate-500">
                文字数目安
              </label>
              <input
                type="number"
                className="w-full rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-sky-300"
                value={limit}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setLimit(Number.isNaN(v) ? 0 : v);
                }}
              />
              <p className="mt-1 text-[10px] text-slate-400">
                実際の設問に書かれている「◯文字程度」を入力してください。
              </p>
            </div>
          </div>
        </section>

        {/* ES本文 */}
        <section className="space-y-2 rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xs font-semibold text-slate-800">
                ES本文（ここに貼り付け or 右側からひな型を挿入）
              </h2>
              <p className="text-[11px] text-slate-500">
                1社分の設問に対する回答をそのまま貼り付けるか、
                右側のストーリーカードからひな型を呼び出して編集してください。
              </p>
            </div>
            <div className="text-right text-[11px] text-slate-500">
              <span
                className={
                  charCount === 0
                    ? ""
                    : charCount < limit * 0.6 || charCount > limit * 1.4
                    ? "font-semibold text-amber-600"
                    : "font-semibold text-emerald-600"
                }
              >
                {charCount} 文字
              </span>
              <span className="text-slate-400"> / 目安 {limit} 文字</span>
            </div>
          </div>
          <textarea
            className="w-full min-h-[220px] rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-sky-300"
            placeholder="ここにES本文をペーストするか、右側のストーリーカードからひな型を挿入できます。"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={handleEvaluate}
              disabled={!text.trim() || isEvaluating}
              className={`rounded-full px-5 py-2 text-xs font-semibold ${
                !text.trim() || isEvaluating
                  ? "cursor-not-allowed bg-slate-200 text-slate-500"
                  : "bg-violet-500 text-white hover:bg-violet-600"
              }`}
            >
              {isEvaluating ? "評価中..." : "AIに添削してもらう（OpenAI）"}
            </button>
          </div>

          {errorMessage && (
            <p className="mt-2 text-[11px] text-rose-600">{errorMessage}</p>
          )}
        </section>

        {/* フィードバック */}
        {score && feedback && (
          <section className="mb-4 space-y-4 rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
            <h2 className="text-xs font-semibold text-slate-800">
              フィードバック結果
            </h2>

            {/* スコア */}
            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-700 md:grid-cols-5">
              <ScorePill label="構成" value={score.structure} />
              <ScorePill label="ロジック" value={score.logic} />
              <ScorePill label="わかりやすさ" value={score.clarity} />
              <ScorePill label="企業フィット" value={score.companyFit} />
              <ScorePill label="文字数フィット" value={score.lengthFit} />
            </div>

            {/* 要約 */}
            <div className="whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-[11px] text-slate-700">
              {feedback.summary}
            </div>

            {/* 強み */}
            <div>
              <p className="mb-1 text-[11px] font-semibold text-emerald-700">
                良いポイント
              </p>
              <ul className="list-disc space-y-1 pl-4 text-[11px] text-slate-700">
                {feedback.strengths.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>

            {/* 改善 */}
            <div>
              <p className="mb-1 text-[11px] font-semibold text-amber-700">
                改善すると一気に良くなるポイント
              </p>
              <ul className="list-disc space-y-1 pl-4 text-[11px] text-slate-700">
                {feedback.improvements.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>

            {/* チェックリスト */}
            <div>
              <p className="mb-1 text-[11px] font-semibold text-slate-800">
                最終チェック用 ToDo
              </p>
              <ul className="list-disc space-y-1 pl-4 text-[11px] text-slate-700">
                {feedback.checklist.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>

            {/* 構成サンプル */}
            <div>
              <p className="mb-1 text-[11px] font-semibold text-slate-800">
                構成サンプル（この順番で直すときれいになります）
              </p>
              <pre className="whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-[11px] text-slate-700">
                {feedback.sampleStructure}
              </pre>
            </div>
          </section>
        )}
      </div>

      {/* 右：ストーリーカード一覧＋ヒント */}
      <aside className="w-80 shrink-0 space-y-4">
        {/* ストーリーカード一覧 */}
        <div className="rounded-2xl border border-sky-100 bg-sky-50/80 p-4 text-[11px] text-slate-700 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-semibold text-sky-800">
              ストーリーカードからESひな型を作る
            </p>
          </div>
          <p className="mb-2 text-[10px] text-slate-600">
            一般面接AIで作ったカードをクリックすると、
            左側のES本文にSTAR構造ベースのひな型が自動で挿入されます。
            その上で企業ごとの細かい調整だけしてください。
          </p>

          {cardsLoading ? (
            <p className="mt-2 text-[11px] text-slate-500">読み込み中...</p>
          ) : cardsError ? (
            <p className="mt-2 text-[11px] text-rose-600">{cardsError}</p>
          ) : storyCards.length === 0 ? (
            <p className="mt-2 text-[11px] text-slate-500">
              まだ保存されたストーリーカードがありません。
              一般面接AIタブからセッションを行い、カードを保存してみてください。
            </p>
          ) : (
            <div className="mt-2 space-y-2 max-h-72 overflow-y-auto">
              {storyCards.map((card) => (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => handleApplyCardToEs(card)}
                  className="w-full rounded-xl border border-slate-100 bg-white/90 p-2 text-left shadow-sm hover:border-sky-200 hover:bg-sky-50/80 transition"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[10px] text-slate-500">
                      {topicLabelFromCard(card.topicType)}
                    </span>
                    <div className="flex items-center gap-1">
                      {card.isSensitive && (
                        <span className="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-[9px] font-semibold text-rose-600 border border-rose-100">
                          🔒 Sensitive
                        </span>
                      )}
                      <span className="text-[9px] text-slate-400">
                        {card.createdAt
                          ? new Date(card.createdAt).toLocaleDateString("ja-JP")
                          : ""}
                      </span>
                    </div>
                  </div>
                  <p className="mt-0.5 line-clamp-1 text-[11px] font-semibold text-slate-800">
                    {card.title || "タイトル未設定"}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-[10px] text-slate-600">
                    {card.star.situation ||
                      "（状況Sが入力されるとここに表示されます）"}
                  </p>
                  {card.axes && card.axes.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {card.axes.slice(0, 3).map((axis) => (
                        <span
                          key={axis}
                          className="rounded-full bg-sky-50 px-2 py-0.5 text-[9px] text-sky-700 border border-sky-100"
                        >
                          {axis}
                        </span>
                      ))}
                      {card.axes.length > 3 && (
                        <span className="text-[9px] text-slate-400">
                          +{card.axes.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}

          <p className="mt-2 text-[10px] text-slate-400">
            ※ カードをクリックすると、現在のES本文はそのひな型で上書きされます。
            必要に応じて事前にコピーしておいてください。
          </p>
        </div>

        {/* ヒント / 将来拡張メモ */}
        <div className="rounded-2xl border border-slate-100 bg-white/80 p-4 text-[11px] text-slate-700 shadow-sm">
          <p className="mb-1 font-semibold text-slate-800">
            このタブの想定フロー
          </p>
          <ol className="mb-2 list-decimal space-y-1 pl-4">
            <li>一般面接AIで1つの経験を深掘りし、カードを保存</li>
            <li>ES添削タブでカードを選び、ひな型を挿入</li>
            <li>企業名・設問に合わせて微修正</li>
            <li>「AIに添削してもらう」で構成・ロジックをチェック</li>
          </ol>
          <p className="mb-1 font-semibold text-sky-800">将来的な拡張メモ</p>
          <ul className="list-disc space-y-1 pl-4">
            <li>Proプランだけ「AIが書き直したドラフト」を別枠で表示</li>
            <li>企業ごとにテンプレを保存して再利用できるようにする</li>
            <li>添削履歴を weekly レポートと連動させる</li>
          </ul>
        </div>
      </aside>
    </div>
  );
};

type ScorePillProps = {
  label: string;
  value: number;
};

const ScorePill: React.FC<ScorePillProps> = ({ label, value }) => {
  const color =
    value >= 8
      ? "bg-emerald-50 text-emerald-700 border-emerald-100"
      : value >= 6
      ? "bg-amber-50 text-amber-700 border-amber-100"
      : "bg-rose-50 text-rose-700 border-rose-100";

  return (
    <div
      className={`flex flex-col items-center justify-center rounded-xl border px-2 py-2 ${color}`}
    >
      <span className="text-[10px]">{label}</span>
      <span className="mt-1 text-sm font-semibold">{value}/10</span>
    </div>
  );
};
