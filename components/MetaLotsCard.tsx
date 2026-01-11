"use client";

import React, { useEffect, useMemo, useState } from "react";

type MetaLot = {
  id: string;
  expires_at: string;
  remaining: number;
  source: string | null;
};

function formatDateJP(iso: string) {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
}

function daysUntil(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function sourceLabel(source: string | null) {
  if (source === "stripe") return "購入";
  if (source === "grant") return "付与";
  if (!source) return "不明";
  return source; // admin など
}

export const MetaLotsCard: React.FC = () => {
  const [lots, setLots] = useState<MetaLot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/meta/active-lots", { cache: "no-store" });
        const json = await res.json();
        if (!mounted) return;
        setLots(json.lots ?? []);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const total = useMemo(
    () => lots.reduce((sum, l) => sum + (l.remaining ?? 0), 0),
    [lots]
  );

  return (
    <div className="rounded-2xl bg-white/70 shadow-sm border border-slate-100 p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-900">利用可能なMETAの内訳</div>
          <div className="text-xs text-slate-500 mt-1">
            有効期限が近いMETAから自動で消費されます。
          </div>
        </div>

        <div className="text-sm font-semibold text-slate-900">
          合計 <span className="tabular-nums">{loading ? "…" : total}</span> META
        </div>
      </div>

      <div className="mt-4">
        {loading ? (
          <div className="text-sm text-slate-500">読み込み中…</div>
        ) : lots.length === 0 ? (
          <div className="text-sm text-slate-500">現在利用可能なMETAはありません。</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {lots.map((lot) => {
              const d = daysUntil(lot.expires_at);
              const badge =
                d <= 7 ? "🔴" : d <= 30 ? "🟠" : "🟢";

              return (
                <div key={lot.id} className="py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-lg">{badge}</div>
                    <div>
                      <div className="text-sm font-medium text-slate-900">
                        {formatDateJP(lot.expires_at)} まで
                      </div>
                      <div className="text-xs text-slate-500">
                        {sourceLabel(lot.source)} ・あと {d} 日
                      </div>
                    </div>
                  </div>

                  <div className="text-sm font-semibold text-slate-900 tabular-nums">
                    {lot.remaining} META
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
