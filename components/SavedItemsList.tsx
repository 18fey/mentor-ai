// src/components/SavedItemsList.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";

type Plan = "free" | "pro" ;
type SaveType = "mistake" | "learning" | "retry";

type SavedItem = {
  id: string;
  attempt_type: string;
  attempt_id: string;
  save_type: SaveType;
  title: string | null;
  summary: string | null;
  score_total: number | null;
  created_at: string;
  payload: any;
  source_id: string | null;
};

type ListRes = {
  ok: true;
  plan: Plan;
  items: SavedItem[];
};

type ApiErr = { error?: string; message?: string };

const TYPE_LABEL: Record<string, string> = {
  case: "ケース",
  fermi: "フェルミ",
  es_review: "ES添削",
  es_draft: "ESドラフト",
  industry_insight: "企業研究",
};

function fmt(d: string) {
  try {
    return new Date(d).toLocaleString("ja-JP", { hour12: false });
  } catch {
    return d;
  }
}

export const SavedItemsList: React.FC = () => {
  const [items, setItems] = useState<SavedItem[]>([]);
  const [plan, setPlan] = useState<Plan>("free");
  const [uiError, setUiError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [filterType, setFilterType] = useState<string>("all");
  const [filterSaveType, setFilterSaveType] = useState<SaveType | "all">("all");
  const [selected, setSelected] = useState<SavedItem | null>(null);

  const visible = useMemo(() => {
    return items.filter((it) => {
      if (filterType !== "all" && it.attempt_type !== filterType) return false;
      if (filterSaveType !== "all" && it.save_type !== filterSaveType) return false;
      return true;
    });
  }, [items, filterType, filterSaveType]);

  const fetchList = async () => {
    setUiError(null);
    setLoading(true);
    try {
      const body: any = { limit: 200 };
      // API側にfilter渡すならここで入れてもOK（今回はクライアント側でfilter）
      const res = await fetch("/api/saves/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = (await res.json().catch(() => null)) as ListRes | ApiErr | null;
      if (!res.ok) {
        setUiError((json as ApiErr | null)?.message ?? "取得に失敗しました");
        return;
      }
      const data = json as ListRes;
      setPlan(data.plan);
      setItems(data.items ?? []);
    } catch (e) {
      console.error(e);
      setUiError("通信エラーが発生しました。");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, []);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-sm font-semibold text-slate-900">保存したもの</h1>
            <p className="mt-1 text-[11px] text-slate-600">
              Plan: <span className="font-semibold">{plan}</span> / 保存履歴をいつでも見返せます。
            </p>
          </div>
          <button
            onClick={fetchList}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              loading ? "bg-slate-200 text-slate-500" : "bg-slate-900 text-white hover:bg-slate-800"
            }`}
            disabled={loading}
          >
            {loading ? "更新中…" : "↻ 更新"}
          </button>
        </div>

        {uiError && (
          <div className="mt-3 rounded-xl border border-rose-100 bg-rose-50 p-3 text-xs text-rose-700">
            {uiError}
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          {(["all", "case", "fermi", "es_review", "es_draft", "industry_insight"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`rounded-full border px-3 py-1 text-[11px] ${
                filterType === t
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {t === "all" ? "すべて" : TYPE_LABEL[t] ?? t}
            </button>
          ))}
          <div className="mx-1 h-6 w-px bg-slate-200" />
          {(["all", "learning", "mistake", "retry"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilterSaveType(s)}
              className={`rounded-full border px-3 py-1 text-[11px] ${
                filterSaveType === s
                  ? "border-sky-700 bg-sky-700 text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {s === "all" ? "全カテゴリ" : s}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {visible.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 text-xs text-slate-500">
            まだ保存がありません。ケース/フェルミ/ES等で「保存」を押すとここに溜まります。
          </div>
        ) : (
          visible.map((it) => (
            <button
              key={it.id}
              onClick={() => setSelected(it)}
              className="text-left rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm hover:bg-slate-50"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-700">
                      {TYPE_LABEL[it.attempt_type] ?? it.attempt_type}
                    </span>
                    <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] text-sky-700">
                      {it.save_type}
                    </span>
                    {typeof it.score_total === "number" && (
                      <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] text-violet-700">
                        Score {it.score_total}
                      </span>
                    )}
                  </div>

                  <p className="mt-2 truncate text-sm font-semibold text-slate-900">
                    {it.title ?? "（無題）"}
                  </p>
                  <p className="mt-1 line-clamp-2 text-[11px] text-slate-600">
                    {it.summary ?? "—"}
                  </p>
                </div>
                <div className="shrink-0 text-[11px] text-slate-500">{fmt(it.created_at)}</div>
              </div>
            </button>
          ))
        )}
      </div>

      {/* 詳細モーダル（簡易） */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-3xl rounded-2xl bg-white p-4 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] text-slate-500">
                  {TYPE_LABEL[selected.attempt_type] ?? selected.attempt_type} / {selected.save_type} /{" "}
                  {fmt(selected.created_at)}
                </p>
                <h2 className="mt-1 text-base font-semibold text-slate-900">
                  {selected.title ?? "（無題）"}
                </h2>
                {selected.summary && <p className="mt-1 text-xs text-slate-600">{selected.summary}</p>}
              </div>
              <button
                onClick={() => setSelected(null)}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs hover:bg-slate-50"
              >
                閉じる
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-3">
                <p className="text-xs font-semibold text-slate-800">入力（input）</p>
                <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap text-[11px] text-slate-700">
{JSON.stringify(selected.payload?.input ?? {}, null, 2)}
                </pre>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-3">
                <p className="text-xs font-semibold text-slate-800">出力/評価（output/eval）</p>
                <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap text-[11px] text-slate-700">
{JSON.stringify(
  { output: selected.payload?.output, eval: selected.payload?.eval },
  null,
  2
)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
