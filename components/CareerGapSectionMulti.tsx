"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { INDUSTRIES, IndustryId, ThinkingTypeId } from "@/lib/careerFitMap";
import { CareerGapResult } from "@/components/CareerGapResult";

type Props = {
  thinkingTypeId: ThinkingTypeId;
  thinkingTypeNameJa: string;
  thinkingTypeNameEn: string;
  typeDescription: string;
};

type Mode = "basic" | "deep";

type PendingPayload = {
  thinkingTypeId: string;
  thinkingTypeNameJa: string;
  thinkingTypeNameEn: string;
  typeDescription: string;
  desiredIndustryIds: IndustryId[];
  userReason: string;
  userExperienceSummary: string;
  mode: Mode;
};

const PENDING_KEY = "mentorai:career_gap_pending_v1";

function uniqIndustries(ids: IndustryId[]) {
  return Array.from(new Set(ids));
}

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

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

  // Deep導線
  const [deepIntent, setDeepIntent] = useState(false); // UI上で「Deepをやりたい」状態
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeMessage, setUpgradeMessage] = useState<string>("");

  const select2Ref = useRef<HTMLSelectElement | null>(null);
  const select3Ref = useRef<HTMLSelectElement | null>(null);
  const resultAnchorRef = useRef<HTMLDivElement | null>(null);

  const desiredIndustryOptions = INDUSTRIES;

  const basicIndustryIds = useMemo(() => {
    return industry1 ? ([industry1] as IndustryId[]) : [];
  }, [industry1]);

  const deepIndustryIds = useMemo(() => {
    const raw = [
      industry1 || null,
      industry2 || null,
      industry3 || null,
    ].filter(Boolean) as IndustryId[];
    return uniqIndustries(raw);
  }, [industry1, industry2, industry3]);

  const canRunBasic = basicIndustryIds.length === 1 && !loadingMode;
  const canRunDeep = industry1 !== "" && !loadingMode;

  // ---- UX: Deep押下で業界2へフォーカス（業界2/3が有効になる）
  const armDeep = () => {
    setDeepIntent(true);
    setError(null);

    // 先に業界1が入ってるなら業界2へ
    setTimeout(() => {
      if (select2Ref.current) {
        select2Ref.current.focus();
      }
    }, 0);
  };

  // ---- 実行（/api/career-gap に統一）
  const run = async (mode: Mode) => {
    setLoadingMode(mode);
    setError(null);

    try {
      if (!industry1) {
        setError("志望業界1を選んでください。");
        return;
      }

      const desiredIndustryIds =
        mode === "deep" ? deepIndustryIds.slice(0, 3) : basicIndustryIds;

      // basicは「1業界固定」
      if (mode === "basic" && desiredIndustryIds.length !== 1) {
        setError("ライト版は志望業界は1つだけ選択してください。");
        return;
      }

      const payload: PendingPayload = {
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      // 401: ログイン
      if (res.status === 401) {
        setError("レポートを見るにはログインが必要です。");
        return;
      }

      // 402: 課金モーダル
      if (res.status === 402) {
        const data = await res.json().catch(() => null);

        // Deepを押してる＝比較価値が見えてる状態なので、モーダルで気持ちよく課金へ
        setUpgradeMessage(
          data?.message ||
            data?.error ||
            "Deep版（最大3業界比較）は Meta または Pro プランで利用できます。"
        );
        setUpgradeOpen(true);

        // 購入後に戻ってきたら自動再実行できるように保存
        try {
          localStorage.setItem(PENDING_KEY, JSON.stringify(payload));
        } catch {}

        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "API error");
      }

      const data = await res.json();
      setResultMarkdown(data.result ?? "");

      // 結果へスクロール（気持ちよさ）
      setTimeout(() => {
        resultAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
    } catch (e) {
      console.error(e);
      setError("生成に失敗しました。時間をおいて再度お試しください。");
    } finally {
      setLoadingMode(null);
    }
  };

  // ---- 購入後の復帰: ?run=deep なら、保存してたpayloadで自動再実行
  useEffect(() => {
    // SSR安全
    const params = new URLSearchParams(window.location.search);
    const shouldRunDeep = params.get("run") === "deep";
    if (!shouldRunDeep) return;

    const pending = safeParse<PendingPayload>(localStorage.getItem(PENDING_KEY));
    if (!pending) return;

    // このページのタイプが違うならやめる（誤爆防止）
    if (pending.thinkingTypeId !== thinkingTypeId) return;

    // UIへ復元
    setDeepIntent(true);
    setIndustry1((pending.desiredIndustryIds?.[0] as IndustryId) ?? "");
    setIndustry2((pending.desiredIndustryIds?.[1] as IndustryId) ?? "");
    setIndustry3((pending.desiredIndustryIds?.[2] as IndustryId) ?? "");
    setUserReason(pending.userReason ?? "");
    setUserExperienceSummary(pending.userExperienceSummary ?? "");

    // 自動再実行
    setTimeout(() => {
      run("deep");
      // 成功/失敗に関係なく pending は消す（無限ループ防止）
      try {
        localStorage.removeItem(PENDING_KEY);
      } catch {}
    }, 200);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thinkingTypeId]);

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
        </div>

        <div className="flex items-center gap-2 rounded-2xl bg-sky-50 px-3 py-2 text-xs text-sky-700">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-sky-600 text-[10px] font-semibold text-white">
            i
          </span>
          <span>ライト版は無料 / Deep版は Meta または Pro</span>
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
          <p className="text-[11px] text-slate-400">
            ライト版はこの1業界だけでOK
          </p>
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
          <p className="text-[11px] text-slate-400">
            Deepは最大3業界まで比較OK
          </p>
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
          <p className="text-[11px] text-slate-400">
            1行でもOK。書くほど精度が上がります
          </p>
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
              <p className="text-xs font-semibold text-slate-900">
                Deep版（Meta / Pro）
              </p>
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
              // まだDeep意図がないなら先に有効化してフォーカス
              if (!deepIntent) {
                armDeep();
                return;
              }
              run("deep");
            }}
            className="mt-3 inline-flex w-full items-center justify-center rounded-full bg-sky-600 px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-sky-700 disabled:opacity-60"
          >
            {loadingMode === "deep"
              ? "Deepレポート生成中…"
              : deepIntent
              ? "Deepレポートを出す（有料）"
              : "Deepで比較する（業界2/3を有効化）"}
          </button>

          <p className="mt-2 text-[11px] text-sky-700/80">
            ※ Deepを押すと、業界2/3が選べるようになります
          </p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mt-4 rounded-2xl border border-rose-100 bg-rose-50/70 px-3 py-2 text-xs text-rose-700">
          {error}
        </div>
      )}

      {/* Result */}
      <div ref={resultAnchorRef} />
      {resultMarkdown && (
        <div className="mt-6">
          <CareerGapResult markdown={resultMarkdown} />
        </div>
      )}

      {/* 402 Upgrade Modal */}
      {upgradeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-lg rounded-3xl border border-slate-100 bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">
                  Deep is locked
                </p>
                <h4 className="mt-1 text-sm font-semibold text-slate-900">
                  Deep版で「勝ち筋」と「次の打ち手」まで出します
                </h4>
                <p className="mt-2 text-xs leading-relaxed text-slate-600">
                  {upgradeMessage}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setUpgradeOpen(false)}
                className="rounded-full px-3 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-50"
              >
                閉じる
              </button>
            </div>

            <div className="mt-4 grid gap-2 md:grid-cols-2">
              <a
                href="/pricing#meta"
                className="inline-flex items-center justify-center rounded-full bg-sky-600 px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-sky-700"
              >
                Metaで今すぐ使う
              </a>

              <a
                href="/pricing"
                className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50"
              >
                Proプランを見る
              </a>
            </div>

            <div className="mt-3 rounded-2xl bg-slate-50 p-3">
              <p className="text-[11px] leading-relaxed text-slate-600">
                購入後にこのページへ戻ってきたら自動でDeepを再実行できます。
                （リダイレクトに <span className="font-semibold">?run=deep</span> を付けるだけ）
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
