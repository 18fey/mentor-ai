// app/page.tsx
import Link from "next/link";
import Dashboard from "@/components/Dashboard";

export default function HomePage() {
  return (
    <div className="min-h-screen space-y-8">
      {/* 🔵 AIタイプ診断ヒーロー */}
      <section>
        <div className="rounded-3xl border border-sky-100 bg-gradient-to-br from-sky-50 via-white to-sky-100/70 p-6 shadow-sm shadow-sky-100 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-sky-500">
              NEW / AI TYPE
            </p>
            <h2 className="text-lg font-semibold text-slate-900">
              AIタイプ診断（16タイプ）
            </h2>
            <p className="text-sm text-slate-600">
              10問の直感アンケートで、あなたの
              <span className="font-semibold">「AIとの付き合い方」</span>を分析します。
              Mentor.AI独自の視点で、仕事でのAI活用スタイルを可視化。
            </p>

            <div className="flex flex-wrap gap-2 text-[11px] text-slate-500">
              <span className="rounded-full bg-white/70 px-2 py-1">
                # 16タイプ診断
              </span>
              <span className="rounded-full bg-white/70 px-2 py-1">
                # 無料
              </span>
              <span className="rounded-full bg-white/70 px-2 py-1">
                # 所要2〜3分
              </span>
            </div>

            <div className="mt-3 flex items-center gap-3">
              <Link
                href="/diagnosis-16type"
                className="inline-flex items-center rounded-full bg-sky-500 px-5 py-2 text-xs font-medium text-white shadow-sm shadow-sky-200 hover:bg-sky-600 transition"
              >
                診断してみる →
              </Link>
              <span className="text-[11px] text-slate-400">
                今の思考パターンを知ろう
              </span>
            </div>
          </div>

          {/* 右側サンプルタイプ */}
          <div className="mt-4 md:mt-0 md:w-52">
            <div className="rounded-2xl bg-white/80 p-4 shadow-sm shadow-sky-100">
              <p className="text-[11px] font-semibold text-slate-500 mb-2">
                診断タイプ例
              </p>
              <div className="rounded-xl bg-sky-50/80 px-3 py-2 text-xs text-sky-800 mb-2">
                <p className="font-semibold">
                  Strategic Co-Pilot
                </p>
                <p className="text-[11px]">
                  戦略的コ・パイロット型<br />
                  AIを右腕にし、共に成果を出すタイプ。
                </p>
              </div>
              <p className="text-[11px] text-slate-500">
                ほか15タイプからあなたを分析。
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 🔽 既存のダッシュボード */}
      <Dashboard />
    </div>
  );
}
