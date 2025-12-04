// components/IndustryInsights.tsx
"use client";

import React, { useState } from "react";

type ResultTab = "insight" | "questions" | "news";

type InsightResult = {
  insight: string;
  questions: string;
  news: string;
};

type IndustryGroup = {
  id: string;
  label: string;
  subs: string[];
};

// キャリタス準拠＋Mentor.AI用に微調整した業界マスタ
const INDUSTRY_GROUPS: IndustryGroup[] = [
  {
    id: "construction_housing_realestate",
    label: "建設・住宅・不動産",
    subs: ["建設", "設備・道路", "住宅", "建設機器", "不動産"],
  },
  {
    id: "food_chem_med",
    label: "食品・化学・医薬",
    subs: ["食品・飲料", "化学", "医薬品", "化粧品・日用品"],
  },
  {
    id: "materials",
    label: "素材",
    subs: ["紙・パルプ", "印刷・インキ", "鉄鋼", "非鉄・金属", "ゴム・ガラス・セメント"],
  },
  {
    id: "electronics_machinery_auto",
    label: "電機・機械・自動車",
    subs: ["電機・電子部品・半導体", "機械", "自動車・自動車部品"],
  },
  {
    id: "transport_energy",
    label: "運輸・エネルギー",
    subs: ["航空", "海運", "鉄道", "陸運・倉庫", "エネルギー（電力・ガス）"],
  },
  {
    id: "finance",
    label: "金融",
    subs: ["銀行", "生保・損保", "証券", "信販・クレカ・リース"],
  },
  {
    id: "trading_distribution",
    label: "商社・流通",
    subs: ["商社", "百貨店・スーパー・コンビニ", "専門店"],
  },
  {
    id: "info_media",
    label: "情報サービス・メディア",
    subs: [
      "フードサービス",
      "旅行・ホテル",
      "マスコミ",
      "エンタメ",
      "教育・人材サービス",
      "ITサービス",
      "ソフトウェア",
      "通信・インターネット",
    ],
  },
  {
    id: "consulting",
    label: "コンサルティング",
    subs: ["戦略コンサル", "総合コンサル（BIG4）", "シンクタンク"],
  },
  {
    id: "finance_advanced",
    label: "ファイナンス（IBD・PE/VC・M&A）",
    subs: ["投資銀行（IBD）", "PE/VC", "マーケッツ", "FAS/M&Aアドバイザリー"],
  },
];

// 「企業の将来性」を一瞬で指定できるショートカットタグ
const FUTURE_TAGS = [
  "強み",
  "弱み",
  "将来性",
  "中期リスク",
  "競争優位性",
  "ビジネスモデルの課題",
  "成長余地",
  "AI/技術変化の影響",
];

// デモ用サンプル（初期表示）
// key = `${groupLabel}|${subLabel}`
const SAMPLE_CONTENT: Record<string, InsightResult> = {
  "コンサルティング|戦略コンサル": {
    insight: `### 戦略コンサル業界のざっくり構造（サンプル）

- 主要プレーヤー：マッキンゼー、BCG、ベイン、RB、A.T. カーニー など
- 案件テーマ：全社戦略、事業ポートフォリオ見直し、新規事業立ち上げ、コスト削減、PMI など
- 価値提供：クライアントの「意思決定」を支えるための示唆出し（定量・定性の両面）

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
  "ファイナンス（IBD・PE/VC・M&A）|投資銀行（IBD）": {
    insight: `### 投資銀行（IBD）のざっくり構造（サンプル）

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
  "ファイナンス（IBD・PE/VC・M&A）|PE/VC": {
    insight: `### PE / VC の観点（サンプル）

- 投資テーマ：事業承継、カーブアウト、成長投資、ベンチャー投資 など
- リターン源泉：EBITDA改善・マルチプル拡大・レバレッジ効果`,
    questions: `### 想定質問例（サンプル）

- どんな産業・テーマで投資機会があると考えているか？
- 1 件の投資案件に対して、どのようにリスクを分解するか？`,
    news: `### ニュースの押さえどころ（サンプル）

- 日本の事業承継問題と PE ファンドの役割
- 世界的な金利動向と VC マネーの流れ`,
  },
  "ファイナンス（IBD・PE/VC・M&A）|マーケッツ": {
    insight: `### マーケッツ・トレーディング（サンプル）

- 役割：マーケットを通じた資金調達・リスク移転のハブ
- 重要視される力：マクロ・ミクロの情報を統合し、ポジションを構築・調整する判断力`,
    questions: `### 想定質問例（サンプル）

- 直近 1 週間の相場の動きをどう説明するか？
- ある金利変動が株式・債券・為替にどう波及すると考えるか？`,
    news: `### ニュースの押さえどころ（サンプル）

- 各国中銀の金融政策と市場への影響
- インフレ指標のサプライズと市場反応`,
  },
};

// デフォルトサンプル（上記に該当しないとき用）
const DEFAULT_SAMPLE: InsightResult = {
  insight: `### 業界インサイト（サンプル）

- ここには、選択した業界の「構造」「プレーヤー」「収益源」「規制」「トレンド」などが整理されます。
- 「インサイトを生成する」を押すと、あなたが選んだ業界・企業に合わせた内容に置き換わります。`,
  questions: `### 想定質問（サンプル）

- ここには、その業界の面接でよく聞かれる質問と答え方のポイントが並びます。`,
  news: `### 直近ニュース（サンプル）

- ここには、業界に関連する直近1〜2年のニュースと、その面接での語り方のヒントが表示されます。`,
};

export default function IndustryInsights() {
  const [selectedGroupId, setSelectedGroupId] = useState<string>(
    INDUSTRY_GROUPS[0]?.id ?? ""
  );
  const [selectedSub, setSelectedSub] = useState<string>(
    INDUSTRY_GROUPS[0]?.subs[0] ?? ""
  );
  const [targetCompany, setTargetCompany] = useState("");
  const [focusTopic, setFocusTopic] = useState("");
  const [includeNews, setIncludeNews] = useState(true);

  const [activeTab, setActiveTab] = useState<ResultTab>("insight");
  const [result, setResult] = useState<InsightResult | null>(null);
  const [hasGenerated, setHasGenerated] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const selectedGroup =
    INDUSTRY_GROUPS.find((g) => g.id === selectedGroupId) ??
    INDUSTRY_GROUPS[0];

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
          industryGroup: selectedGroup.label,
          industrySub: selectedSub,
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

  const getDisplayText = () => {
    const sampleKey = `${selectedGroup.label}|${selectedSub}`;
    const fallback =
      SAMPLE_CONTENT[sampleKey] ??
      (selectedGroup.label === "コンサルティング" &&
      selectedSub === "戦略コンサル"
        ? SAMPLE_CONTENT["コンサルティング|戦略コンサル"]
        : DEFAULT_SAMPLE);

    const source: InsightResult = result || fallback;

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
          建設・金融・商社・IT・コンサル・投資銀行 など、志望業界ごとの
          「構造」「想定質問」「直近ニュース」「企業の強み/弱み・将来性」を一度に整理できる画面です。
        </p>
        <p className="mt-1 text-[11px] text-slate-400">
          志望業界がまだ決まっていない場合は、「コンサルティング」や「ファイナンス（IBD・PE/VC・M&A）」から見ていくと全体像を掴みやすくなります。
        </p>
      </div>

      {/* 設定パネル */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex flex-col gap-4">
        {/* 業界大分類タブ */}
        <div className="flex flex-wrap gap-2">
          {INDUSTRY_GROUPS.map((group) => (
            <button
              key={group.id}
              onClick={() => {
                setSelectedGroupId(group.id);
                setSelectedSub(group.subs[0]); // 大分類切り替え時は最初の小分類にリセット
                if (!result) {
                  setActiveTab("insight");
                }
              }}
              className={`px-3 py-1.5 rounded-full text-xs md:text-sm border transition
                ${
                  selectedGroupId === group.id
                    ? "bg-sky-500 text-white border-sky-500"
                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                }`}
            >
              {group.label}
            </button>
          ))}
        </div>

        {/* 小分類チップ */}
        <div className="flex flex-wrap gap-2 mt-1">
          {selectedGroup.subs.map((sub) => (
            <button
              key={sub}
              onClick={() => setSelectedSub(sub)}
              className={`px-3 py-1.5 rounded-full text-xs border transition
                ${
                  selectedSub === sub
                    ? "bg-sky-100 text-sky-800 border-sky-300"
                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                }`}
            >
              {sub}
            </button>
          ))}
        </div>

        {/* 将来性ショートカットチップ */}
        <div className="flex flex-wrap gap-1.5 mt-2">
          <span className="text-[11px] text-slate-500 mr-1">
            ワンタップで深掘りしたい切り口を追加：
          </span>
          {FUTURE_TAGS.map((tag) => (
            <button
              key={tag}
              onClick={() =>
                setFocusTopic((prev) =>
                  prev.includes(tag)
                    ? prev
                    : prev
                    ? `${prev} ${tag}`
                    : tag
                )
              }
              className="px-2 py-1 rounded-full text-[11px] border border-slate-200 bg-slate-50 hover:bg-sky-50 hover:border-sky-200"
            >
              {tag}
            </button>
          ))}
        </div>

        {/* 入力フォーム */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-600">
              志望企業（任意）
            </label>
            <input
              value={targetCompany}
              onChange={(e) => setTargetCompany(e.target.value)}
              placeholder="例）三菱商事、トヨタ自動車、マッキンゼー、ゴールドマン・サックス など"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400 bg-slate-50"
            />
            <span className="text-[11px] text-slate-400">
              企業名を入れると、その企業の<strong>強み・弱み・将来性</strong>も含めて整理します。
            </span>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-600">
              特に深掘りしたいテーマ（任意）
            </label>
            <input
              value={focusTopic}
              onChange={(e) => setFocusTopic(e.target.value)}
              placeholder="例）弱み 将来性 中期リスク 競争優位性 など"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400 bg-slate-50"
            />
            <span className="text-[11px] text-slate-400">
              「弱み」「将来性」「中期リスク」などを入れると、企業の将来性まで踏み込んだインサイトが生成されます。
            </span>
          </div>
        </div>

        {/* オプション＋ボタン */}
        <div className="flex items-center justify-between gap-4 mt-2">
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
              ボタンを押すと、選んだ業界×企業×テーマに合わせて、インサイト・想定質問・直近ニュースがタブごとに表示されます。
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
