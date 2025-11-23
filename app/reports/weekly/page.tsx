// app/reports/weekly/page.tsx
"use client";

import { useEffect, useState } from "react";

type WeeklyReport = {
  profileSummary?: string;
  axes?: {
    label: string;
    description: string;
    relatedCards: string[];
  }[];
  aiComments?: {
    keywords?: string[];
    strengthSummary?: string;
    weakPointSummary?: string;
    nextWeekSuggestions?: string[];
  };
};

export default function WeeklyReportPage() {
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [cards, setCards] = useState<any[]>([]);
  const [period, setPeriod] = useState<{ from?: string; to?: string }>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const res = await fetch("/api/reports/weekly");
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "failed");
        }

        setReport(data.report ?? null);
        setCards(data.cards ?? []);
        setPeriod({ from: data.meta?.from, to: data.meta?.to });
      } catch (e: any) {
        console.error(e);
        setError("レポートの取得に失敗しました。");
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, []);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-8 text-sm text-slate-600">
        週次レポートを生成しています…
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-8 text-sm text-red-500">
        {error}
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-8 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-900">
          週次自己分析レポート
        </h1>
        <p className="text-xs text-slate-500">
          {period.from && period.to
            ? `対象期間：${new Date(period.from).toLocaleDateString(
                "ja-JP"
              )} 〜 ${new Date(period.to).toLocaleDateString("ja-JP")}`
            : "直近1週間分のストーリーカードを集計しています。"}
        </p>
      </header>

      {/* プロフィール要約 */}
      <section className="rounded-2xl border border-slate-100 bg-white/80 p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800 mb-1">
          1. あなたの現在地（プロフィール要約）
        </h2>
        <p className="text-sm text-slate-700 whitespace-pre-wrap">
          {report?.profileSummary ??
            "プロフィール情報が少ないため、要約はまだ十分ではありません。/profile から基本情報を登録すると、ここがよりリッチになります。"}
        </p>
      </section>

      {/* 就活の軸 */}
      <section className="rounded-2xl border border-sky-100 bg-sky-50/60 p-4 shadow-sm space-y-3">
        <h2 className="text-sm font-semibold text-sky-800">
          2. この1週間から見える「就活の軸」
        </h2>
        {report?.axes && report.axes.length > 0 ? (
          <div className="grid md:grid-cols-2 gap-3 text-sm">
            {report.axes.map((axis, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-sky-100 bg-white/70 p-3"
              >
                <p className="text-xs font-semibold text-sky-700 mb-1">
                  {axis.label}
                </p>
                <p className="text-xs text-slate-700 mb-2 whitespace-pre-wrap">
                  {axis.description}
                </p>
                {axis.relatedCards && axis.relatedCards.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {axis.relatedCards.map((title) => (
                      <span
                        key={title}
                        className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] text-sky-700 border border-sky-100"
                      >
                        {title}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-600">
            まだ十分なカードがないため、軸の抽出は行っていません。
            一般面接AIで2〜3個ストーリーカードを作ると、ここに整理されて表示されます。
          </p>
        )}
      </section>

      {/* AIコメント */}
      <section className="grid md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 shadow-sm text-sm">
          <h2 className="text-sm font-semibold text-emerald-800 mb-2">
            3. 今週の強みの傾向
          </h2>
          <p className="text-xs text-slate-700 whitespace-pre-wrap">
            {report?.aiComments?.strengthSummary ??
              "まだ十分なデータがないため、強みの傾向は集計していません。"}
          </p>
        </div>

        <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-4 shadow-sm text-sm">
          <h2 className="text-sm font-semibold text-amber-800 mb-2">
            4. 今週時点での「伸びしろ」
          </h2>
          <p className="text-xs text-slate-700 whitespace-pre-wrap">
            {report?.aiComments?.weakPointSummary ??
              "今週のカード数が少ないため、まだ明確なギャップは出ていません。"}
          </p>
        </div>
      </section>

      {/* 来週への提案 */}
      <section className="rounded-2xl border border-violet-100 bg-violet-50/70 p-4 shadow-sm text-sm">
        <h2 className="text-sm font-semibold text-violet-800 mb-2">
          5. 来週やると良い「自己分析タスク」
        </h2>
        {report?.aiComments?.nextWeekSuggestions &&
        report.aiComments.nextWeekSuggestions.length > 0 ? (
          <ul className="list-disc list-inside space-y-1 text-xs text-slate-700">
            {report.aiComments.nextWeekSuggestions.map((s, idx) => (
              <li key={idx} className="whitespace-pre-wrap">
                {s}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-slate-700">
            一般面接AIで2〜3本新しいストーリーカードを作ると、ここに「来週の推奨タスク」が並びます。
          </p>
        )}
      </section>

      {/* 今週作られたカード一覧 */}
      <section className="rounded-2xl border border-slate-100 bg-white/80 p-4 shadow-sm text-sm">
        <h2 className="text-sm font-semibold text-slate-800 mb-2">
          6. 今週作成されたストーリーカード一覧
        </h2>
        {cards.length === 0 ? (
          <p className="text-xs text-slate-600">
            今週保存されたストーリーカードはまだありません。
            一般面接AIからカードを保存すると、ここに表示されます。
          </p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {cards.map((c) => (
              <div
                key={c.id}
                className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 text-xs"
              >
                <p className="text-[11px] text-slate-500">
                  {new Date(c.created_at).toLocaleString("ja-JP")}
                </p>
                <p className="font-semibold text-slate-800">{c.title}</p>
                <p className="mt-1 text-slate-700 line-clamp-2">
                  {c.star_situation}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
