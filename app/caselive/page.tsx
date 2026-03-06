"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CaseInterviewLive } from "@/components/CaseInterviewLive";
import { MetaConfirmModal } from "@/components/MetaConfirmModal";

type CaseQuestion = {
  id: string;
  title: string;
  client: string;
  prompt: string;
  // generate側には domain/pattern/hint/kpiExamples もあるけど、Liveでは最小でOK
};

export default function CaseLivePage() {
  const router = useRouter();

  const [caseData, setCaseData] = useState<CaseQuestion | null>(null);
  const [loading, setLoading] = useState(true);
  const [uiError, setUiError] = useState<string | null>(null);

  // META modal
  const [metaOpen, setMetaOpen] = useState(false);
  const [metaNeed, setMetaNeed] = useState<number>(1);
  const [pendingConfirm, setPendingConfirm] = useState<null | (() => Promise<void>)>(null);

  const closeMeta = () => {
    setMetaOpen(false);
    setPendingConfirm(null);
  };

  const fetchCase = useCallback(
    async (metaConfirm: boolean) => {
      setUiError(null);
      setLoading(true);

      try {
        const res = await fetch("/api/case/generate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(metaConfirm ? { "X-Meta-Confirm": "1" } : {}),
          },
          body: JSON.stringify({
            domain: "consulting",
            pattern: "market_sizing",
            count: 1,
          }),
        });

        const data: any = await res.json().catch(() => ({}));

        // --- 401: 未ログイン
        if (!res.ok && res.status === 401) {
          setUiError("ログインが必要です。ログインし直してください。");
          // あなたの導線に合わせて
          router.push("/login"); // もし /login がないならコメントアウトでOK
          return;
        }

        // --- 402: META不足 → confirmモーダル出す
        if (!res.ok && res.status === 402 && data?.error === "need_meta") {
          const requiredMeta = Number(data?.requiredMeta ?? data?.required ?? 1);
          setMetaNeed(requiredMeta);

          setPendingConfirm(() => async () => {
            // confirm後の再実行
            await fetchCase(true);
          });

          setMetaOpen(true);
          return;
        }

        // --- その他エラー
        if (!res.ok || !data?.ok) {
          setUiError(data?.message ?? `ケース生成に失敗しました（status=${res.status}）`);
          return;
        }

        // --- 成功：cases or case 互換
        const c =
          (Array.isArray(data?.cases) && data.cases[0]) ||
          data?.case ||
          null;

        if (!c?.id || !c?.prompt) {
          setUiError("生成結果が不正です（caseが取れません）");
          return;
        }

        setCaseData({
          id: String(c.id),
          title: String(c.title ?? ""),
          client: String(c.client ?? ""),
          prompt: String(c.prompt ?? ""),
        });
      } catch (e) {
        console.error(e);
        setUiError("通信エラーが発生しました。");
      } finally {
        setLoading(false);
      }
    },
    [router]
  );

  useEffect(() => {
    fetchCase(false);
  }, [fetchCase]);

  return (
    <div className="min-h-screen bg-[#F3F6FD] px-6 py-6 md:px-10 md:py-8">
      <header className="mb-6 flex flex-col gap-2">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-xs text-violet-600 shadow-sm border border-white/60">
          <span className="inline-block h-2 w-2 rounded-full bg-violet-400" />
          Mentor.AI Live Module
        </div>

        <div className="flex items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold text-slate-900">
              ケース面接 Live
            </h1>
            <p className="text-sm md:text-base text-slate-500">
              10分思考 → 10分発表 → 自動文字起こし → AI評価
            </p>
          </div>

          <button
            onClick={() => fetchCase(false)}
            disabled={loading}
            className={`rounded-full px-4 py-2 text-xs font-semibold text-white ${
              loading ? "bg-slate-300" : "bg-violet-600 hover:bg-violet-700"
            }`}
          >
            {loading ? "生成中…" : "🎲 新しいケース"}
          </button>
        </div>
      </header>

      <main className="rounded-3xl border border-white/80 bg-white/80 shadow-sm backdrop-blur-sm p-6">
        {uiError && (
          <div className="mb-4 rounded-2xl border border-rose-100 bg-rose-50 p-3 text-xs text-rose-700">
            {uiError}
          </div>
        )}

        {loading && <p className="text-sm text-slate-500">ケース生成中…</p>}

        {!loading && caseData && <CaseInterviewLive caseData={caseData} />}

        {!loading && !caseData && !uiError && (
          <p className="text-sm text-slate-500">ケースがありません。</p>
        )}
      </main>

      {/* ✅ 402 need_meta 用モーダル（既存コンポーネント流用） */}
      <MetaConfirmModal
        open={metaOpen}
        onClose={closeMeta}
        featureLabel={"ケース面接 Live"}
        requiredMeta={metaNeed}
        balance={null} // ここは簡易。必要なら /api/meta/balance を叩いて入れる
        mode={"confirm"} // 残高チェック無しの簡易版（足りなければAPI側でまた402返る）
        title={"METAが必要です"}
        message={`この実行には META が ${metaNeed} 必要です。続行しますか？`}
        onConfirm={async () => {
          const fn = pendingConfirm;
          closeMeta();
          if (fn) await fn();
        }}
        onPurchase={() => router.push("/pricing")}
      />
    </div>
  );
}