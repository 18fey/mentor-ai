// app/growth/page.tsx
import { createServerSupabase } from "@/utils/supabase/server";
import Link from "next/link";

export const dynamic = "force-dynamic";

type GrowthLog = {
  id: string;
  user_id: string;
  source: string;
  title: string;
  description: string | null;
  metadata: any | null;
  created_at: string;
};

const SOURCE_LABEL: Record<string, { label: string; emoji: string }> = {
  diagnosis: { label: "AI思考タイプ診断", emoji: "🧠" },
  career_gap: { label: "キャリア相性レポート", emoji: "💼" },
  es: { label: "ES添削", emoji: "📝" },
  interview: { label: "AI面接", emoji: "🎤" },
};

function formatJpDate(iso: string) {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}/${m}/${day} ${hh}:${mm}`;
}

export default async function GrowthPage() {
  const supabase = await createServerSupabase(); // ★ ここだけ変更

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-xl font-semibold text-slate-900">
          Growth Inbox
        </h1>
        <p className="mt-3 text-sm text-slate-600">
          成長ログを見るにはログインが必要です。
        </p>
        <Link
          href="/auth"
          className="mt-4 inline-flex items-center justify-center rounded-full bg-sky-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-sky-700"
        >
          ログインページへ
        </Link>
      </main>
    );
  }

  const { data: logs, error } = await supabase
    .from("growth_logs")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("growth_logs fetch error:", error);
  }

  const safeLogs: GrowthLog[] = logs ?? [];

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            Growth Inbox
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Mentor.AIでの診断・ギャップ分析・ES添削・面接など、
            あなたの成長ログがここに時系列でたまっていきます。
          </p>
        </div>
      </header>

      {safeLogs.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-6 text-center text-sm text-slate-500">
          まだ成長ログがありません。
          <br />
          まずは16タイプ診断やキャリア相性レポートを試してみてください。
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {safeLogs.map((log) => {
            const meta = SOURCE_LABEL[log.source] ?? {
              label: "その他",
              emoji: "✨",
            };
            const mode =
              typeof log.metadata?.mode === "string"
                ? (log.metadata.mode as string)
                : undefined;

            return (
              <li
                key={log.id}
                className="group rounded-2xl border border-slate-100 bg-white/90 px-4 py-3 shadow-sm shadow-slate-100 transition hover:border-sky-100 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{meta.emoji}</span>
                      <p className="text-xs font-medium text-slate-500">
                        {meta.label}
                      </p>
                      {mode && (
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            mode === "deep"
                              ? "bg-sky-100 text-sky-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {mode === "deep" ? "Deep" : "Lite"}
                        </span>
                      )}
                    </div>
                    <h2 className="mt-1 text-sm font-semibold text-slate-900">
                      {log.title}
                    </h2>
                    {log.description && (
                      <p className="mt-1 text-xs text-slate-600">
                        {log.description}
                      </p>
                    )}
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400">
                    {formatJpDate(log.created_at)}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
