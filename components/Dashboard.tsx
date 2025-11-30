// components/Dashboard.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

type Database = any;

type DashboardProps = {
  onNavigate?: (tab: string) => void;
};

type Profile = {
  id: string;
  name?: string;
  university?: string;
  faculty?: string;
  grade?: string;
  plan?: "free" | "beta" | "pro";
  betaUser?: boolean;
};

type ScoreDashboard = {
  overallScore: number;
  caseScore: number;
  fermiScore: number;
  interviewScore: number;
  esScore: number;
  recentSessions: {
    id: string;
    type: string;
    title: string;
    score: number;
    createdAt: string;
  }[];
};

type WeeklyAxis = {
  label: string;
  description?: string;
  relatedCards?: string[];
};

type WeeklyReport = {
  profile: any;
  cards: any[];
  report?: {
    profileSummary?: string;
    axes?: WeeklyAxis[];
    aiComments?: {
      keywords?: string[];
      strengthSummary?: string;
      weakPointSummary?: string;
      nextWeekSuggestions?: string[];
    };
  };
  meta?: {
    from: string;
    to: string;
  };
};

export default function Dashboard({ onNavigate }: DashboardProps) {
  const router = useRouter();
  const supabase = createClientComponentClient<Database>();

  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [scores, setScores] = useState<ScoreDashboard | null>(null);
  const [weekly, setWeekly] = useState<WeeklyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // ---------------------------
  // ログインユーザー & 各種データ取得
  // ---------------------------
  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setLoadError(null);

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push("/auth");
          return;
        }

        setUserId(user.id);

        const [profileRes, scoreRes, weeklyRes] = await Promise.all([
          fetch(`/api/profile/get?userId=${user.id}`),
          fetch(`/api/score-dashboard?userId=${user.id}`),
          fetch(`/api/reports/weekly?userId=${user.id}`),
        ]);

        if (profileRes.ok) {
          const p = await profileRes.json();
          if (p.profile) {
            setProfile({
              id: p.profile.id,
              name: p.profile.name,
              university: p.profile.university,
              faculty: p.profile.faculty,
              grade: p.profile.grade,
              plan: p.profile.plan ?? "free",
              betaUser: p.profile.betaUser ?? false,
            });
          }
        }

        if (scoreRes.ok) {
          const s = await scoreRes.json();
          setScores(s);
        }

        if (weeklyRes.ok) {
          const w = await weeklyRes.json();
          setWeekly(w);
        }
      } catch (e) {
        console.error("Dashboard load error:", e);
        setLoadError("ダッシュボードの読み込み中にエラーが発生しました。");
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [supabase, router]);

  const lastUpdated = useMemo(() => {
    if (weekly?.meta?.to) {
      try {
        return new Date(weekly.meta.to).toLocaleString("ja-JP");
      } catch {
        return null;
      }
    }
    return null;
  }, [weekly]);

  const planLabel = useMemo(() => {
    if (!profile?.plan) return "Free プラン";
    if (profile.plan === "pro") return "PRO プラン";
    if (profile.plan === "beta") return "βテストユーザー";
    return "Free プラン";
  }, [profile]);

  const profileSummary =
    weekly?.report?.profileSummary ||
    "これまでの面接・ケース・ESのデータをもとに、あなたの強み・弱み・就活の軸をここに要約して表示します。";

  const nextSuggestions =
    weekly?.report?.aiComments?.nextWeekSuggestions && weekly.report.aiComments.nextWeekSuggestions.length > 0
      ? weekly.report.aiComments.nextWeekSuggestions
      : [
          "ガクチカ1本をSTARで話す練習をしてみましょう。",
          "一般面接AIで『自己PR』を1セッション分練習してみましょう。",
        ];

  const axes = weekly?.report?.axes || [];

  const recentSessions = scores?.recentSessions ?? [];

  return (
    <div className="min-h-screen bg-[#F3F6FD] px-6 py-6 md:px-10 md:py-8">
      {/* ヘッダー */}
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-8">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-xs text-sky-600 shadow-sm border border-white/60 mb-2">
            <span className="inline-block h-2 w-2 rounded-full bg-sky-400" />
            Mentor.AI 就活ダッシュボード
          </div>
          <h1 className="text-2xl md:text-3xl font-semibold text-slate-900">
            ホーム
          </h1>
          <p className="mt-1 text-sm md:text-base text-slate-500">
            {profile
              ? `${profile.name ?? "あなた"} さん専用の就活ダッシュボード。これまでのスコアとストーリーカードをもとに、AIが次の一手を提案します。`
              : "あなた専用の就活ダッシュボード。AIと一緒にケース・フェルミ・面接対策を進められます。"}
          </p>
        </div>

        <div className="flex items-center gap-3 self-start md:self-auto">
          <span className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-600 border border-sky-100">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            {planLabel}
          </span>
          <div className="text-xs md:text-sm text-slate-500">
            更新:{" "}
            <span className="font-medium">
              {lastUpdated ?? "データ取得待ち"}
            </span>
          </div>
        </div>
      </header>

      {/* プロフィール / セットアップ */}
      <section className="mb-8 rounded-3xl border border-white/70 bg-white/80 shadow-sm backdrop-blur-sm">
        <div className="flex flex-col gap-4 p-6 md:p-8">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-sky-500">
                PROFILE & DATA
              </p>
              <h2 className="mt-1 text-lg md:text-xl font-semibold text-slate-900">
                あなたのプロフィールとスコアに基づいて表示しています
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                プロフィール・面接AI・ケースAI・ES添削の結果が自動的にここへ集約されます。
                まだデータが少ない場合は、一部サンプル文が表示されます。
              </p>
            </div>
            <div className="flex flex-wrap gap-3 md:justify-end">
              <button
                className="inline-flex items-center justify-center rounded-full bg-sky-500 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-sky-600 transition"
                onClick={() => onNavigate?.("profile")}
              >
                プロフィールを編集
              </button>
              <button
                className="inline-flex items-center justify-center rounded-full bg-white px-5 py-2 text-sm font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 transition"
                onClick={() => onNavigate?.("settings")}
              >
                プラン・利用状況を確認
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 text-xs md:text-sm text-slate-500">
            <span className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
              スコア・履歴をユーザーごとに保存
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              週次レポートで自己分析を自動生成
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
              ストーリーカードとESテンプレを一元管理
            </span>
          </div>

          {loading && (
            <p className="text-xs text-slate-400">
              データを読み込んでいます…
            </p>
          )}
          {loadError && (
            <p className="text-xs text-red-500">{loadError}</p>
          )}
        </div>
      </section>

      {/* 上部4カード：完全個別スコア */}
      <section className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DashboardStatCard
          label="総合スコア（最新）"
          value={scores ? `${scores.overallScore} 点` : "—"}
          helper="ケース・フェルミ・面接・ESの総合評価"
          iconBg="bg-sky-50"
        />
        <DashboardStatCard
          label="ケース面接スコア"
          value={scores ? `${scores.caseScore} 点` : "—"}
          helper="ロジック・構造化・仮説思考"
          iconBg="bg-violet-50"
        />
        <DashboardStatCard
          label="フェルミ推定スコア"
          value={scores ? `${scores.fermiScore} 点` : "—"}
          helper="分解・数値感覚・見積もり精度"
          iconBg="bg-amber-50"
        />
        <DashboardStatCard
          label="一般面接 / ESスコア"
          value={
            scores
              ? `${Math.round(
                  (scores.interviewScore + scores.esScore) / 2
                )} 点`
              : "—"
          }
          helper="話し方・STAR・文章力の総合"
          iconBg="bg-emerald-50"
        />
      </section>

      {/* グラフ + 軸分析 */}
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-2 mb-8">
        {/* 自己分析サマリー */}
        <div className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-sm backdrop-blur-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-slate-900">
                今のあなたのプロフィール
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                直近のストーリーカードと面接ログからAIが要約したプロフィールです。
              </p>
            </div>
          </div>

          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
            {profileSummary}
          </p>
        </div>

        {/* 就活の軸 / 重点分野 */}
        <div className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-sm backdrop-blur-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-slate-900">
                就活の軸・強みマップ
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                ストーリーカードから抽出された「軸」と、それを支えるエピソード。
              </p>
            </div>
          </div>

          {axes.length === 0 ? (
            <p className="text-xs text-slate-500">
              まだストーリーカードが少ないため、軸分析はこれから表示されます。
              一般面接AIやケースAIを使うと、ここに自動で溜まっていきます。
            </p>
          ) : (
            <div className="space-y-3 text-xs">
              {axes.map((axis, i) => (
                <div
                  key={axis.label ?? i}
                  className="rounded-2xl bg-slate-50 px-3 py-3 border border-slate-100"
                >
                  <p className="text-[11px] font-semibold text-slate-800">
                    {axis.label}
                  </p>
                  {axis.description && (
                    <p className="mt-1 text-[11px] text-slate-600">
                      {axis.description}
                    </p>
                  )}
                  {axis.relatedCards && axis.relatedCards.length > 0 && (
                    <p className="mt-1 text-[11px] text-slate-400">
                      関連エピソード：{axis.relatedCards.join(" / ")}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 下部：おすすめ & セッション履歴 */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 今日のおすすめ対策（週次レポートの提案） */}
        <div className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-sm backdrop-blur-sm">
          <h3 className="text-sm font-medium text-slate-900 mb-2">
            今日のおすすめ対策
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            週次レポートのコメントをもとに、今週やると良いアクションをリストアップしました。
          </p>
          <ul className="space-y-3 text-sm">
            {nextSuggestions.map((s, i) => (
              <li
                key={i}
                className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3"
              >
                <div className="pr-2">
                  <p className="font-medium text-slate-900">
                    アクション {i + 1}
                  </p>
                  <p className="text-xs text-slate-500">{s}</p>
                </div>
                <span className="rounded-full bg-sky-100 px-3 py-1 text-[11px] font-medium text-sky-700">
                  所要 15〜20分
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* 直近のセッション履歴（完全個別） */}
        <div className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-sm backdrop-blur-sm">
          <h3 className="text-sm font-medium text-slate-900 mb-2">
            直近のセッション履歴
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            あなたが実際に実行したトレーニングセッションの履歴です。
          </p>
          <div className="space-y-3 text-sm">
            {recentSessions.length === 0 ? (
              <p className="text-xs text-slate-500">
                まだセッション履歴がありません。ケース面接AIや一般面接AIを使い始めると、ここに履歴が表示されます。
              </p>
            ) : (
              recentSessions.slice(0, 3).map((s) => (
                <HistoryRow
                  key={s.id}
                  type={s.type}
                  title={s.title}
                  score={`${s.score} 点`}
                  time={new Date(s.createdAt).toLocaleString("ja-JP")}
                />
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

type StatCardProps = {
  label: string;
  value: string;
  helper: string;
  iconBg: string;
};

function DashboardStatCard({
  label,
  value,
  helper,
  iconBg,
}: StatCardProps) {
  return (
    <div className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-sm backdrop-blur-sm flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-2xl ${iconBg}`}
        >
          <span className="h-5 w-5 rounded-lg bg-white/80 shadow-sm" />
        </div>
      </div>
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
        <p className="mt-1 text-[11px] text-slate-400">{helper}</p>
      </div>
    </div>
  );
}

type LegendProps = {
  label: string;
  value: string;
  colorClass: string;
};

function LegendItem({ label, value, colorClass }: LegendProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${colorClass}`} />
        <span className="text-xs text-slate-600">{label}</span>
      </div>
      <span className="text-[11px] text-slate-400">{value}</span>
    </div>
  );
}

type HistoryProps = {
  type: string;
  title: string;
  score: string;
  time: string;
};

function HistoryRow({ type, title, score, time }: HistoryProps) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3">
      <div className="space-y-1">
        <p className="text-[11px] font-medium text-slate-500">{type}</p>
        <p className="text-sm font-medium text-slate-900">{title}</p>
        <p className="text-[11px] text-slate-400">{time}</p>
      </div>
      <span className="text-xs font-semibold text-slate-700">{score}</span>
    </div>
  );
}
