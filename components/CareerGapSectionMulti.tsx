"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { INDUSTRIES, IndustryId, ThinkingTypeId } from "@/lib/careerFitMap";
import { CareerGapResult } from "@/components/CareerGapResult";
import { MetaConfirmModal } from "@/components/MetaConfirmModal";

type Props = {
  thinkingTypeId: ThinkingTypeId;
  thinkingTypeNameJa: string;
  thinkingTypeNameEn: string;
  typeDescription: string;
};

type Mode = "basic" | "deep";
type SavedCareerGapMode = "lite" | "deep";

function uniqIndustries(ids: IndustryId[]) {
  return Array.from(new Set(ids));
}

type GateLike = {
  ok?: boolean;
  status?: number;
  error?: string;
  message?: string;
  feature?: string;

  // ✅ career-gap で返ってくる可能性があるキーに全部対応
  reason?: string; // "insufficient_meta" など
  required?: number; // ← スクショの required: 3
  requiredMeta?: number; // 互換
  cost?: number; // 互換
  balance?: number | null;
};

export const CareerGapSectionMulti: React.FC<Props> = ({
  thinkingTypeId,
  thinkingTypeNameJa,
  thinkingTypeNameEn,
  typeDescription,
}) => {
  const [industry1, setIndustry1] = useState<IndustryId | "">("");
  const [industry2, setIndustry2] = useState<IndustryId | "">("");
  const [industry3, setIndustry3] = useState<IndustryId | "">("");

  const [userReason, setUserReason] = useState("");
  const [userExperienceSummary, setUserExperienceSummary] = useState("");

  const [loadingMode, setLoadingMode] = useState<Mode | null>(null);
  const [resultMarkdown, setResultMarkdown] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  // Deep導線（比較UIを有効化するだけ）
  const [deepIntent, setDeepIntent] = useState(false);

  // ✅ Meta消費確認モーダル
  const [metaConfirmOpen, setMetaConfirmOpen] = useState(false);
  const [metaRequired, setMetaRequired] = useState<number>(0);
  const [metaBalance, setMetaBalance] = useState<number | null>(null);
  const [metaMessage, setMetaMessage] = useState<string>(
    "Deep版はMETAを消費して生成します。よろしければ続行してください。"
  );
  const [metaModalMode, setMetaModalMode] = useState<"confirm" | "purchase">(
    "confirm"
  );

  // ✅ 前回結果情報（任意表示用）
  const [lastMode, setLastMode] = useState<SavedCareerGapMode | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);

  const select2Ref = useRef<HTMLSelectElement | null>(null);
  const select3Ref = useRef<HTMLSelectElement | null>(null);
  const resultAnchorRef = useRef<HTMLDivElement | null>(null);

  const desiredIndustryOptions = INDUSTRIES;

  const basicIndustryIds = useMemo(() => {
    return industry1 ? ([industry1] as IndustryId[]) : [];
  }, [industry1]);

  const deepIndustryIds = useMemo(() => {
    const raw = [industry1 || null, industry2 || null, industry3 || null].filter(
      Boolean
    ) as IndustryId[];
    return uniqIndustries(raw);
  }, [industry1, industry2, industry3]);

  const canRunBasic = basicIndustryIds.length === 1 && !loadingMode;
  const canRunDeep = industry1 !== "" && !loadingMode;

  const armDeep = () => {
    setDeepIntent(true);
    setError(null);
    setTimeout(() => select2Ref.current?.focus(), 0);
  };

  // ✅ リロードしても「前回結果」を復元
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const res = await fetch("/api/career-gap/last", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json().catch(() => null);

        if (!mounted) return;

        if (data?.ok && data?.result) {
          setResultMarkdown(String(data.result));
          setLastMode((data.mode ?? null) as SavedCareerGapMode | null);
          setLastUpdatedAt((data.updatedAt ?? null) as string | null);

          // 前回が deep なら比較UIもONにしておく（任意）
          if (data.mode === "deep") setDeepIntent(true);
        }
      } catch (e) {
        console.error("career-gap last load failed:", e);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  // ✅ confirmed=true のときだけ X-Meta-Confirm: 1 を付けて再実行
  const run = async (mode: Mode, confirmed: boolean = false) => {
    setLoadingMode(mode);
    setError(null);

    try {
      if (!industry1) {
        setError("志望業界1を選んでください。");
        return;
      }

      const desiredIndustryIds =
        mode === "deep" ? deepIndustryIds.slice(0, 3) : basicIndustryIds;

      if (mode === "basic" && desiredIndustryIds.length !== 1) {
        setError("ライト版は志望業界は1つだけ選択してください。");
        return;
      }

      const payload = {
        thinkingTypeId,
        thinkingTypeNameJa,
        thinkingTypeNameEn,
        typeDescription,
        desiredIndustryIds,
        userReason,
        userExperienceSummary,
        mode,
      };

      const res = await fetch("/api/career-gap", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(confirmed ? { "X-Meta-Confirm": "1" } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (res.status === 401) {
        setError("レポートを見るにはログインが必要です。");
        return;
      }

      // ✅ 402: gateからの応答（insufficient_meta / confirm_needed など）
      if (res.status === 402) {
        const gate = (await res.json().catch(() => null)) as GateLike | null;

        const required = Number(
          gate?.required ?? gate?.requiredMeta ?? gate?.cost ?? 0
        );
        const balance = (gate?.balance ?? null) as number | null;
        const reason = gate?.reason ?? "";

        setMetaRequired(required);
        setMetaBalance(balance);

        // ✅ 不足時は購入モード
        if (reason === "insufficient_meta") {
          setMetaModalMode("purchase");
          setMetaMessage(
            gate?.message ||
              `この実行には META が ${required} 必要です。購入して続行してください。`
          );
          setMetaConfirmOpen(true);
          return;
        }

        // ✅ それ以外（確認が必要など）は confirm モード
        setMetaModalMode("confirm");
        setMetaMessage(
          gate?.message ||
            "Deep版はMETAを消費して生成します。よろしければ続行してください。"
        );
        setMetaConfirmOpen(true);
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "API error");
      }

      const data = await res.json();
      setResultMarkdown(data.result ?? "");

      // ✅ 反映：保存済みのlastも更新されてるはずなので軽く取り直す（任意）
      try {
        const last = await fetch("/api/career-gap/last", {
          cache: "no-store",
        }).then((r) => r.json());
        if (last?.ok) {
          setLastMode((last.mode ?? null) as SavedCareerGapMode | null);
          setLastUpdatedAt((last.updatedAt ?? null) as string | null);
        }
      } catch {}

      setTimeout(() => {
        resultAnchorRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 50);
    } catch (e) {
      console.error(e);
      setError("生成に失敗しました。時間をおいて再度お試しください。");
    } finally {
      setLoadingMode(null);
    }
  };

  const locked = !deepIntent;

  return (
    <section className="mt-10 rounded-3xl border border-slate-100 bg-white/90 p-6 shadow-sm shadow-slate-100">
      {/* Header */}
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="max-w-[780px]">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">
            Next Action
          </p>
          <h3 className="mt-1 text-sm font-semibold text-slate-900">
            志望業界との「マッチ・ギャップ」を見て、次の動きを決める
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            まずはライト版（無料）で「方向性」を掴む。必要なら Deep版で
            <span className="font-semibold text-slate-700"> 最大3業界を比較</span>
            して、勝ち筋と3ヶ月アクションまで落とし込みます。
          </p>

          {(lastMode || lastUpdatedAt) && (
            <p className="mt-2 text-[11px] text-slate-400">
              前回：{lastMode ?? "-"} / {lastUpdatedAt ?? "-"}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 rounded-2xl bg-sky-50 px-3 py-2 text-xs text-sky-700">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-sky-600 text-[10px] font-semibold text-white">
            i
          </span>
          <span>ライト版は無料 / Deep版は META 消費</span>
        </div>
      </div>

      {/* Industry selects */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-700">
            志望業界 1 <span className="text-rose-500">(必須)</span>
          </label>
          <select
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            value={industry1}
            onChange={(e) => setIndustry1(e.target.value as IndustryId | "")}
          >
            <option value="">選択する</option>
            {desiredIndustryOptions.map((ind) => (
              <option key={ind.id} value={ind.id}>
                {ind.labelJa}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-slate-400">ライト版はこの1業界だけでOK</p>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-700">
            志望業界 2 <span className="text-slate-400">(Deepで有効)</span>
          </label>
          <div className="relative">
            <select
              ref={select2Ref}
              disabled={locked}
              className={[
                "w-full rounded-xl border px-3 py-2 text-xs outline-none focus:ring-2",
                locked
                  ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400"
                  : "border-slate-200 bg-white text-slate-800 focus:border-sky-400 focus:ring-sky-100",
              ].join(" ")}
              value={industry2}
              onChange={(e) => setIndustry2(e.target.value as IndustryId | "")}
            >
              <option value="">選択しない</option>
              {desiredIndustryOptions.map((ind) => (
                <option key={ind.id} value={ind.id}>
                  {ind.labelJa}
                </option>
              ))}
            </select>

            {locked && (
              <button
                type="button"
                onClick={armDeep}
                className="absolute inset-0 rounded-xl border border-transparent"
                aria-label="Deepを有効化"
              />
            )}
          </div>

          {locked ? (
            <button
              type="button"
              onClick={armDeep}
              className="text-[11px] font-semibold text-sky-700 underline underline-offset-2 hover:opacity-80"
            >
              Deep版で比較する（業界2を有効化）
            </button>
          ) : (
            <p className="text-[11px] text-slate-400">比較したい業界があれば追加</p>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-700">
            志望業界 3 <span className="text-slate-400">(Deepで有効)</span>
          </label>
          <div className="relative">
            <select
              ref={select3Ref}
              disabled={locked}
              className={[
                "w-full rounded-xl border px-3 py-2 text-xs outline-none focus:ring-2",
                locked
                  ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400"
                  : "border-slate-200 bg-white text-slate-800 focus:border-sky-400 focus:ring-sky-100",
              ].join(" ")}
              value={industry3}
              onChange={(e) => setIndustry3(e.target.value as IndustryId | "")}
            >
              <option value="">選択しない</option>
              {desiredIndustryOptions.map((ind) => (
                <option key={ind.id} value={ind.id}>
                  {ind.labelJa}
                </option>
              ))}
            </select>

            {locked && (
              <button
                type="button"
                onClick={armDeep}
                className="absolute inset-0 rounded-xl border border-transparent"
                aria-label="Deepを有効化"
              />
            )}
          </div>
          <p className="text-[11px] text-slate-400">Deepは最大3業界まで比較OK</p>
        </div>
      </div>

      {/* Inputs */}
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-700">
            志望理由（ざっくりでOK）
          </label>
          <textarea
            className="min-h-[104px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs leading-relaxed text-slate-800 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            placeholder="例）IBで大きなお金が動く現場を見たい / 事業会社のM&Aに関わりたい など"
            value={userReason}
            onChange={(e) => setUserReason(e.target.value)}
          />
          <p className="text-[11px] text-slate-400">1行でもOK。書くほど精度が上がります</p>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-700">
            ガクチカ・これまでの経験（任意）
          </label>
          <textarea
            className="min-h-[104px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs leading-relaxed text-slate-800 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            placeholder="例）長期インターン / サークル運営 / ボランティア など（箇条書きでOK）"
            value={userExperienceSummary}
            onChange={(e) => setUserExperienceSummary(e.target.value)}
          />
          <p className="text-[11px] text-slate-400">
            空欄でもOK（ただし書くほど「刺さる作戦」になる）
          </p>
        </div>
      </div>

      {/* CTA */}
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-100 bg-white p-4">
          <p className="text-xs font-semibold text-slate-900">ライト版（無料）</p>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
            まずは「方向性」。タイプ×業界のマッチ度と、強み/ギャップ/次の一手を1分で。
          </p>

          <button
            type="button"
            disabled={!canRunBasic}
            onClick={() => run("basic")}
            className="mt-3 inline-flex w-full items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-slate-800 disabled:opacity-60"
          >
            {loadingMode === "basic" ? "ライト版を生成中…" : "ライト版で見る（無料）"}
          </button>
        </div>

        <div className="rounded-2xl border border-sky-100 bg-sky-50/70 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-slate-900">Deep版（META）</p>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-[11px] leading-relaxed text-slate-600">
                <li>最大3業界を比較（どこが勝てるかが一瞬で見える）</li>
                <li>攻め/守りの戦い方、企業選びの軸、ギャップの埋め方</li>
                <li>ES・面接・ケース/フェルミまで「次に何を使うか」指定</li>
              </ul>
            </div>

            {!deepIntent && (
              <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[10px] font-semibold text-sky-700">
                比較モード
              </span>
            )}
          </div>

          <button
            type="button"
            disabled={!canRunDeep}
            onClick={() => {
              if (!deepIntent) {
                armDeep();
                return;
              }
              // ✅ 先にAPI叩いて gate(402)で purchase/confirm を出し分ける
              run("deep");
            }}
            className="mt-3 inline-flex w-full items-center justify-center rounded-full bg-sky-600 px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-sky-700 disabled:opacity-60"
          >
            {loadingMode === "deep"
              ? "Deepレポート生成中…"
              : deepIntent
              ? "Deepレポートを出す（META消費）"
              : "Deepで比較する（業界2/3を有効化）"}
          </button>

          <p className="mt-2 text-[11px] text-sky-700/80">
            ※ Deepを押すと必要に応じて「META消費の確認 / 購入導線」が出ます
          </p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mt-4 rounded-2xl border border-rose-100 bg-rose-50/70 px-3 py-2 text-xs text-rose-700">
          {error}
          <div className="mt-2">
            <a
              href="/pricing#meta"
              className="text-[11px] font-semibold text-rose-700 underline underline-offset-2"
            >
              METAを購入する →
            </a>
          </div>
        </div>
      )}

      {/* Result */}
      <div ref={resultAnchorRef} />
      {resultMarkdown && (
        <div className="mt-6">
          <CareerGapResult markdown={resultMarkdown} />
        </div>
      )}

      {/* ✅ Meta Confirm Modal */}
      <MetaConfirmModal
        open={metaConfirmOpen}
        onClose={() => setMetaConfirmOpen(false)}
        title="METAを消費してDeepレポートを実行しますか？"
        message={metaMessage}
        requiredMeta={metaRequired}
        balance={metaBalance}
        mode={metaModalMode}
        confirmLabel="METAを使って続行"
        cancelLabel="やめる"
        purchaseLabel="METAを購入する"
        onConfirm={() => {
          setMetaConfirmOpen(false);
          // ✅ confirm 済みで再実行（X-Meta-Confirm: 1）
          run("deep", true);
        }}
        onPurchase={() => {
          window.location.href = "/pricing#meta";
        }}
      />
    </section>
  );
};
