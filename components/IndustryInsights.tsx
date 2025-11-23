// components/IndustryInsights.tsx
"use client";

import React, { useState } from "react";

type IndustryKey =
  | "consulting"
  | "ib"
  | "pevc"
  | "trading"
  | "it"
  | "manufacturing"
  | "others";

type ResultTab = "insight" | "questions" | "news";

type InsightResult = {
  insight: string;
  questions: string;
  news: string;
};

const INDUSTRY_LABELS: { key: IndustryKey; label: string }[] = [
  { key: "consulting", label: "戦略コンサル" },
  { key: "ib", label: "投資銀行" },
  { key: "pevc", label: "PE / VC" },
  { key: "trading", label: "マーケッツ・トレーディング" },
  { key: "it", label: "IT / メガベンチャー" },
  { key: "manufacturing", label: "メーカー" },
  { key: "others", label: "その他" },
];

// 業界ごとのデモ用サンプル（初期表示）
const SAMPLE_CONTENT: Record<
  IndustryKey,
  {
    insight: string;
    questions: string;
    news: string;
  }
> = {
  consulting: {
    insight: `### 戦略コンサル業界のざっくり構造（サンプル）

- 主要プレーヤー：マッキンゼー、BCG、ベイン、RB、A.T. カーニー など
- 案件テーマ：全社戦略、事業ポートフォリオ見直し、新規事業立ち上げ、コスト削減、PMI など
- 求められる視点：クライアントの「意思決定」を支えるための、定量・定性の両面からの示唆出し

### 押さえておきたい論点

- 日本企業の競争力低下の要因と、その処方箋
- DX・生成AI を前提とした「人と組織」の変革
- 産業ごとの構造変化（金融・自動車・小売・製造 など）をどう捉えているか`,
    questions: `### 想定質問例（サンプル）

1. **なぜコンサル業界の中でも戦略ファームなのか？**
2. **最近気になったビジネスニュースを 1 つ挙げて、そのインパクトを教えてください。**
3. **日本企業が今後 5〜10 年で直面すると考える最大の構造変化は何ですか？**
4. **チームで意見が割れた経験と、そのときあなたがどう振る舞ったかを教えてください。**
5. **CASE：日本のサブスク型サービス市場の規模をざっくり推定してください。**`,
    news: `### 直近ニュースの押さえどころ（サンプル）

- 生成AI・オートメーションの浸透に伴う「ホワイトカラーの仕事の再定義」
- 脱炭素・サステナビリティに関する規制強化と、企業のビジネスモデル転換
- 金利上昇局面での資本コスト見直し・不採算事業の整理

→ 「この変化がクライアント企業のどの意思決定に影響しそうか？」まで言えると評価されやすいです。`,
  },
  ib: {
    insight: `### 投資銀行業界のざっくり構造（サンプル）

- 主な機能：M&A アドバイザリー、ECM（株式）、DCM（債券）、ストラクチャードファイナンス
- 価値提供：企業価値評価・資本政策・構造改革の選択肢提示とエグゼキューション支援`,
    questions: `### 想定質問例（サンプル）

1. **なぜコンサルではなく投資銀行なのか？**
2. **ROE/ROIC を使って、良い企業とそうでない企業をどう見分ける？**
3. **日本企業の PBR 1 倍割れ問題をどう捉えているか？**
4. **最近興味を持った M&A 案件と、そのポイントを教えてください。**`,
    news: `### 直近ニュースの押さえどころ（サンプル）

- 東証による資本コスト・株価意識改革要請（PBR 1 倍割れ是正の流れ）
- 金利上昇局面における LBO・不動産ファイナンスの潮流
- スタートアップ〜上場市場（グロース市場等）の動き`,
  },
  pevc: {
    insight: `### PE / VC の観点（サンプル）

- 投資テーマ：事業承継、カーブアウト、成長投資、ベンチャー投資 など`,
    questions: `### 想定質問例（サンプル）

- どんな産業・テーマで投資機会があると考えているか？
- 1 件の投資案件に対して、どのようにリスクを分解するか？`,
    news: `### ニュースの押さえどころ（サンプル）

- 日本の事業承継問題と PE ファンドの役割
- 世界的な金利動向と VC マネーの流れ`,
  },
  trading: {
    insight: `### マーケッツ・トレーディング（サンプル）

- マクロ指標（金利・為替・インフレ）とマーケットの動きの因果を説明できることが重要。`,
    questions: `### 想定質問例（サンプル）

- 直近 1 週間の相場の動きをどう説明するか？`,
    news: `### ニュースの押さえどころ（サンプル）

- 各国中銀の金融政策と市場への影響`,
  },
  it: {
    insight: `### IT / メガベンチャー（サンプル）

- ビジネスモデル：SaaS / プラットフォーム / 広告 / サブスク など`,
    questions: `### 想定質問例（サンプル）

- 最近使っているプロダクトの中で、「プロダクトマネージャーならどこを改善するか？」`,
    news: `### ニュースの押さえどころ（サンプル）

- 生成AI・SaaS・モバイルアプリのトレンド`,
  },
  manufacturing: {
    insight: `### メーカー（サンプル）

- 製造業 × DX / 脱炭素 / サプライチェーン再編 がキーワード。`,
    questions: `### 想定質問例（サンプル）

- 日本の製造業が持つ強み・弱みは何か？`,
    news: `### ニュースの押さえどころ（サンプル）

- 自動車・電機・素材など主要産業の構造変化`,
  },
  others: {
    insight: `### その他業界（サンプル）

- 商社・不動産・インフラ・官公庁など、業界ごとに「収益構造」と「規制」を押さえるのが第一歩。`,
    questions: `### 想定質問例（サンプル）

- なぜこの業界・この会社なのか？を、他業界と比較しながら説明できるか。`,
    news: `### ニュースの押さえどころ（サンプル）

- マクロ経済・政策動向が当該業界にどう効くか。`,
  },
};

export default function IndustryInsights() {
  const [selectedIndustry, setSelectedIndustry] =
    useState<IndustryKey>("consulting");
  const [targetCompany, setTargetCompany] = useState("");
  const [focusTopic, setFocusTopic] = useState("");
  const [includeNews, setIncludeNews] = useState(true);

  const [activeTab, setActiveTab] = useState<ResultTab>("insight");
  const [result, setResult] = useState<InsightResult | null>(null);
  const [hasGenerated, setHasGenerated] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleGenerate = async () => {
    setIsLoading(true);
    setErrorMessage("");
    setHasGenerated(true);

    try {
      const res = await fetch("/api/industry-insights", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          industry: selectedIndustry,
          targetCompany: targetCompany || null,
          focusTopic: focusTopic || null,
          includeNews,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("API error:", text);
        throw new Error("サーバーエラーが発生しました");
      }

      const data = (await res.json()) as InsightResult;
      setResult(data);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(
        err?.message ||
          "インサイトの生成に失敗しました。時間をおいて再度お試しください。"
      );
      setResult(null);
    } finally {
      setIsLoading(false);
    }
  };

  const sample = SAMPLE_CONTENT[selectedIndustry];

  const getDisplayText = () => {
    const source: InsightResult = result || sample;

    if (activeTab === "insight") return source.insight;
    if (activeTab === "questions") return source.questions;
    return source.news;
  };

  return (
    <div className="flex flex-col gap-6 w-full h-full">
      {/* タイトル */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 mb-1">
          業界別インサイト
        </h1>
        <p className="text-sm text-slate-500">
          戦略コンサル・投資銀行・PE/VC・商社・IT など、志望業界ごとの
          「よく聞かれる質問・押さえるべきトピック・直近ニュース」を一度に整理できる画面です。
        </p>
        <p className="mt-1 text-[11px] text-slate-400">
          志望業界がまだ決まっていない場合は、「戦略コンサル」か「投資銀行」から見ていくと全体像を掴みやすくなります。
        </p>
      </div>

      {/* 設定パネル */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex flex-col gap-4">
        {/* 業界タブ */}
        <div className="flex flex-wrap gap-2">
          {INDUSTRY_LABELS.map((item) => (
            <button
              key={item.key}
              onClick={() => {
                setSelectedIndustry(item.key);
                if (!result) {
                  setActiveTab("insight");
                }
              }}
              className={`px-3 py-1.5 rounded-full text-sm border transition
                ${
                  selectedIndustry === item.key
                    ? "bg-sky-500 text-white border-sky-500"
                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* 入力フォーム */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-600">
              志望企業（任意）
            </label>
            <input
              value={targetCompany}
              onChange={(e) => setTargetCompany(e.target.value)}
              placeholder="例）マッキンゼー、ゴールドマン・サックス、三菱商事 など"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400 bg-slate-50"
            />
            <span className="text-[11px] text-slate-400">
              企業名を入れると、その企業の選考で出やすいテーマを優先して整理します。
            </span>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-600">
              特に深掘りしたいテーマ（任意）
            </label>
            <input
              value={focusTopic}
              onChange={(e) => setFocusTopic(e.target.value)}
              placeholder="例）ESG投資、再エネ、半導体、地方創生、スタートアップ支援 など"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400 bg-slate-50"
            />
            <span className="text-[11px] text-slate-400">
              気になっているニューステーマやキーワードがあれば入力してください。
            </span>
          </div>
        </div>

        {/* オプション＋ボタン */}
        <div className="flex items-center justify-between gap-4 mt-1">
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={includeNews}
              onChange={(e) => setIncludeNews(e.target.checked)}
              className="rounded border-slate-300 text-sky-500 focus:ring-sky-500"
            />
            直近1〜2年のニュース・トレンドも含めてほしい
          </label>

          <div className="flex flex-col items-end gap-1">
            <button
              onClick={handleGenerate}
              disabled={isLoading}
              className="inline-flex items-center justify-center px-4 py-2 rounded-xl text-sm font-medium bg-sky-500 text-white hover:bg-sky-600 disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
            >
              {isLoading ? "生成中..." : "インサイトを生成する"}
            </button>
            <p className="text-[11px] text-slate-400">
              ボタンを押してから数秒で、面接に直結するインサイト・想定質問・直近ニュースがタブごとに表示されます。
            </p>
          </div>
        </div>

        {errorMessage && (
          <p className="text-xs text-red-500 mt-1">{errorMessage}</p>
        )}
      </div>

      {/* 結果表示 */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex-1 flex flex-col overflow-hidden">
        {/* 結果タブ */}
        <div className="flex items-center gap-2 mb-3 border-b border-slate-100 pb-2">
          {[
            { key: "insight", label: "インサイト" },
            { key: "questions", label: "想定質問" },
            { key: "news", label: "直近ニュース" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as ResultTab)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                activeTab === tab.key
                  ? "bg-sky-500 text-white"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100"
              }`}
            >
              {tab.label}
            </button>
          ))}

          {hasGenerated && (
            <span className="ml-auto text-[11px] text-slate-400">
              ※ 現在の内容は、あなたの入力をもとに AI が生成した結果です。
            </span>
          )}
        </div>

        {/* 本文エリア */}
        <div className="flex-1 overflow-auto">
          {isLoading && (
            <p className="text-sm text-slate-500">
              インサイトを生成しています…
            </p>
          )}

          {!isLoading && (
            <div className="prose prose-sm max-w-none text-slate-800">
              {!result && (
                <p className="text-[11px] text-slate-400 mb-3">
                  ※ まずはサンプルとして業界ごとのインサイト例を表示しています。
                  「インサイトを生成する」を押すと、あなたの入力に合わせた内容に置き換わります。
                </p>
              )}
              {getDisplayText()
                .split("\n")
                .map((line, idx) => (
                  <p key={idx} className="whitespace-pre-wrap">
                    {line}
                  </p>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
