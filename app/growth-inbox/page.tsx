// app/growth-inbox/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

type GrowthLog = {
  id: string;
  user_id: string;
  source: string;
  title: string;
  description: string | null;
  metadata: any;
  created_at: string;
};

export default function GrowthInboxPage() {
  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  const [logs, setLogs] = useState<GrowthLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        setLoading(true);
        setError(null);

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setError("ログインが必要です。");
          return;
        }

        const { data, error } = await supabase
          .from("growth_logs")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(50);

        if (error) {
          console.error("growth_logs fetch error:", error);
          setError("成長ログの取得に失敗しました。");
          return;
        }

        setLogs(data ?? []);
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, [supabase]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#F5FAFF] to-white px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-xl font-semibold text-slate-900">
          Growth Inbox
        </h1>
        <p className="mt-1 text-xs text-slate-600">
          あなたが Mentor.AI で行った診断・ES添削・キャリア分析などのログを、
          1つのタイムラインとして振り返ることができます。
        </p>

        {loading && (
          <p className="mt-6 text-sm text-slate-500">読み込み中です…</p>
        )}
        {error && (
          <p className="mt-6 text-sm text-rose-600">{error}</p>
        )}

        {!loading && !error && logs.length === 0 && (
          <p className="mt-6 text-sm text-slate-500">
            まだ成長ログはありません。診断やES添削を行うとここに記録されます。
          </p>
        )}

        <div className="mt-6 space-y-3">
          {logs.map((log) => {
            const date = new Date(log.created_at);
            const dateLabel = date.toLocaleString("ja-JP", {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            });

            return (
              <article
                key={log.id}
                className="rounded-2xl border border-slate-100 bg-white/95 p-4 text-sm shadow-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-sky-600">
                    {log.source.toUpperCase()}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {dateLabel}
                  </span>
                </div>
                <h2 className="mt-1 text-sm font-semibold text-slate-900">
                  {log.title}
                </h2>
                {log.description && (
                  <p className="mt-1 text-xs text-slate-600">
                    {log.description.length > 120
                      ? log.description.slice(0, 120) + "…"
                      : log.description}
                  </p>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </main>
  );
}
