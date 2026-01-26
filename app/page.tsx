// app/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";

type Database = any;

// ------------------------------
// Supabase
// ------------------------------
const createBrowserSupabaseClient = () =>
  createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

type SupabaseClient = ReturnType<typeof createBrowserSupabaseClient>;

// ------------------------------
// Types
// ------------------------------
type BaseStepId = 1 | 2 | 3 | 4 | 5;

type BaseStep = {
  id: BaseStepId;
  title: string;
  description: string;
  href: string;
  completed: boolean;
  badge?: string;
};

type ProfileStatusRow = {
  onboarding_completed: boolean | null;
  ai_type_key: string | null;
  first_run_completed: boolean | null;
};

type GrowthLogRow = {
  id: string;
  user_id: string;
  source: string;
  title: string;
  created_at: string;
};

type NextAction = {
  title: string;
  reason: string;
  href: string;
  badge?: string;
};

type UsageSummaryItem = {
  feature: string;
  label: string;
  emoji?: string;
  usedThisMonth: number;
  freeLimit: number; // proなら 0 でもOK（unlimited扱い）
  remaining: number; // proなら 9999 などでもOK（unlimited扱い）
};

type UsageSummaryResponse = {
  ok: boolean;
  plan: "free" | "pro";
  monthStartISO: string;
  items: UsageSummaryItem[];
};

// ✅ Meta lots
type MetaLot = {
  id: string;
  expires_at: string;
  remaining: number;
  source: string | null;
  initial_amount?: number | null;
  purchased_at?: string | null;
};

// ------------------------------
// Labels
// ------------------------------
const SOURCE_LABEL: Record<string, { label: string; emoji: string }> = {
  diagnosis: { label: "AI思考タイプ診断", emoji: "🧠" },
  career_gap: { label: "キャリア相性レポート", emoji: "💼" },
  es_draft: { label: "ESドラフト", emoji: "📝" },
  es_correction: { label: "ES添削", emoji: "✅" },
  interview_10: { label: "一般面接（10問）", emoji: "🎤" },
  industry: { label: "企業研究", emoji: "📚" },
  case: { label: "ケース面接AI", emoji: "🧩" },
  fermi: { label: "フェルミ推定AI", emoji: "📏" },
  ai_training: { label: "AI思考力トレーニング", emoji: "🧠" },
};

function formatJpShort(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("ja-JP", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ✅ META helpers
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
  if (source === "admin") return "付与";
  if (!source) return "不明";
  return source;
}
function expiryBadge(days: number) {
  if (days <= 7) return "🔴";
  if (days <= 30) return "🟠";
  return "🟢";
}

function pickNextActions(params: {
  logs: GrowthLogRow[];
  step3Completed: boolean;
  step4Completed: boolean;
  step5Completed: boolean;
}) {
  const { logs, step3Completed, step4Completed, step5Completed } = params;

  const last = logs[0];
  const lastLabel = last ? SOURCE_LABEL[last.source]?.label ?? "アクティビティ" : null;

  const actions: NextAction[] = [];

  if (!step3Completed) {
    actions.push({
      title: "一般面接（10問）を1セッションだけ終える（10〜15分）",
      reason: "まずは“話す→素材化”が最短。ここができるとES・面接が一気に進みます。",
      href: "/general",
      badge: "最優先",
    });
  } else if (!step4Completed) {
    actions.push({
      title: "ESを1本作る（ドラフト or 添削）",
      reason: "面接ログ（素材）がすでにあるので、今が一番“成果物化”しやすいタイミングです。",
      href: "/es",
      badge: "おすすめ",
    });
  } else if (!step5Completed) {
    actions.push({
      title: "キャリアマッチ診断で、志望とのギャップと打ち手を出す",
      reason: "土台（プロフィール/診断/ES）が揃ってきたので、次は“戦い方の最適化”が効きます。",
      href: "/diagnosis-16type",
      badge: "おすすめ",
    });
  } else {
    if (last?.source === "es_draft" || last?.source === "es_correction") {
      actions.push({
        title: "企業研究で、志望業界の“評価される型”を掴む",
        reason: "直近はESまで進んでいるので、次は“業界の勝ち筋”を押さえると精度が上がります。",
        href: "/industry",
      });
    } else if (last?.source === "interview_10") {
      actions.push({
        title: "ESをもう1本作って、志望先ごとに使い分ける",
        reason: "直近の素材が新鮮なうちに、ESに変換して“使えるストック”を増やすのが最短です。",
        href: "/es",
      });
    } else {
      actions.push({
        title: "AI思考力トレーニングを1タスクだけ（ウォームアップ）",
        reason: lastLabel
          ? `直近は「${lastLabel}」だったので、今日は軽く“思考の型”でバランスを取るのがおすすめです。`
          : "今日は軽く“思考の型”でバランスを取るのがおすすめです。",
        href: "/mentor-ai-index",
      });
    }
  }

  if (actions.length === 1) {
    actions.push({
      title: "プロフィールを最新の志望業界・企業にアップデートする（3分）",
      reason: "提案の精度が上がります。志望が変わったタイミングで更新しておくと強いです。",
      href: "/profile",
    });
  }

  return actions.slice(0, 2);
}

// ✅ STEP3〜5 固定化：growth_logs を “存在確認” で判定する
async function hasAnyLog(
  supabase: SupabaseClient,
  userId: string,
  sources: string[]
): Promise<boolean> {
  const { data, error } = await supabase
    .from("growth_logs")
    .select("id")
    .eq("user_id", userId)
    .in("source", sources)
    .limit(1);

  if (error) {
    console.error("hasAnyLog error:", error);
    return false;
  }
  return (data?.length ?? 0) > 0;
}

// ★ APP_MODE
const APP_MODE = process.env.NEXT_PUBLIC_APP_MODE || "production";

// ✅ AI思考タイプ診断は「任意」にする（ロック解除条件・進捗%から除外）
const REQUIRED_STEP_IDS = new Set<BaseStepId>([1, 3, 4, 5]); // 2 は任意

export default function HomePage() {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);

  const isClosed = APP_MODE === "closed";

  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [baseSteps, setBaseSteps] = useState<BaseStep[]>([]);
  const [recentLogs, setRecentLogs] = useState<GrowthLogRow[]>([]);
  const [nextActions, setNextActions] = useState<NextAction[]>([]);

  // ✅ サマリー（直近50件ベース）
  const [interview10Count, setInterview10Count] = useState(0);
  const [esDraftCount, setEsDraftCount] = useState(0);
  const [esCorrectionCount, setEsCorrectionCount] = useState(0);

  // ✅ Usage Summary（今月の無料枠）
  const [usage, setUsage] = useState<UsageSummaryResponse | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);

  // ✅ META lots（期限付き内訳）
  const [metaLots, setMetaLots] = useState<MetaLot[]>([]);
  const [metaLotsLoading, setMetaLotsLoading] = useState(false);

  async function fetchUsageSummary() {
    try {
      setUsageLoading(true);
      const res = await fetch("/api/usage/summary", { method: "GET", cache: "no-store" });
      const json = (await res.json()) as UsageSummaryResponse;
      if (json?.ok) setUsage(json);
    } catch (e) {
      console.error("usage summary fetch error:", e);
    } finally {
      setUsageLoading(false);
    }
  }

  async function fetchActiveMetaLots() {
    try {
      setMetaLotsLoading(true);
      const res = await fetch("/api/meta/active-lots", { method: "GET", cache: "no-store" });
      const json = await res.json();
      setMetaLots((json?.lots ?? []) as MetaLot[]);
    } catch (e) {
      console.error("meta lots fetch error:", e);
      setMetaLots([]);
    } finally {
      setMetaLotsLoading(false);
    }
  }

  // ✅ サーバ側でパーソナライズした NextActions を取る（あれば優先）
  async function fetchNextActionsFromApi() {
    try {
      const res = await fetch("/api/recommendations/next-actions", {
        method: "GET",
        cache: "no-store",
      });
      const json = await res.json();
      if (json?.ok && Array.isArray(json.actions)) {
        setNextActions(json.actions as NextAction[]);
      }
    } catch (e) {
      console.error("next-actions fetch error:", e);
    }
  }

  useEffect(() => {
    if (isClosed) return;

    const run = async () => {
      try {
        const {
          data: { user },
          error: authErr,
        } = await supabase.auth.getUser();

        if (authErr) console.error("auth getUser error:", authErr);

        if (!user) {
          router.replace("/auth");
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("onboarding_completed, ai_type_key, first_run_completed")
          .eq("id", user.id)
          .maybeSingle<ProfileStatusRow>();

        if (profileError) {
          console.error(profileError);
          setError("プロフィールの読み込みに失敗しました。");
          setChecking(false);
          return;
        }

        if (!profile || !profile.onboarding_completed) {
          router.replace("/onboarding");
          return;
        }

        // ✅ ここ重要：自己ループになるので gate しない（first_run_completed は別導線で使うなら /start 等へ）
        // if (!profile.first_run_completed) {
        //   router.replace("/start");
        //   return;
        // }

        const step1Completed = !!profile.onboarding_completed;
        const step2Completed = !!profile.ai_type_key;

        // ✅ STEP3〜5 固定判定
        const [step3Completed, step4Completed, step5Completed] = await Promise.all([
          hasAnyLog(supabase, user.id, ["interview_10"]),
          hasAnyLog(supabase, user.id, ["es_draft", "es_correction"]),
          hasAnyLog(supabase, user.id, ["career_gap"]),
        ]);

        // ✅ growth_logs（直近）
        const { data: logs, error: logsError } = await supabase
          .from("growth_logs")
          .select("id,user_id,source,title,created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(50);

        if (logsError) console.error("growth_logs fetch error:", logsError);

        const safeLogs: GrowthLogRow[] = (logs ?? []) as GrowthLogRow[];

        setRecentLogs(safeLogs.slice(0, 5));

        // ✅ サマリー（直近50件内）
        const i10 = safeLogs.filter((l) => l.source === "interview_10").length;
        const d = safeLogs.filter((l) => l.source === "es_draft").length;
        const c = safeLogs.filter((l) => l.source === "es_correction").length;

        setInterview10Count(i10);
        setEsDraftCount(d);
        setEsCorrectionCount(c);

        // ✅ NextActions：サーバAPI優先 → 失敗したらクライアント側fallback
        await fetchNextActionsFromApi();
        setNextActions((prev) => {
          if (prev && prev.length > 0) return prev;
          return pickNextActions({
            logs: safeLogs,
            step3Completed,
            step4Completed,
            step5Completed,
          });
        });

        setBaseSteps([
          {
            id: 1,
            title: "プロフィール",
            description: "所属やステータス、志望業界など、AIが最適化するための前提を入力します。",
            href: "/profile",
            completed: step1Completed,
          },
          {
            id: 2,
            title: "AI思考タイプ診断（任意）",
            description:
              "直感アンケート10問で、あなたの「AIとの付き合い方」と思考スタイルを16タイプにマッピングします。（後からいつでもOK）",
            href: "/onboarding/ai-typing",
            completed: step2Completed,
            badge: "任意",
          },
          {
            id: 3,
            title: "一般面接（10問）を1セッション終える",
            description: "10問の一般面接で経験の素材を作り、ES/面接に使えるストックにします。",
            href: "/general",
            completed: step3Completed,
            badge: "推奨",
          },
          {
            id: 4,
            title: "ES（ドラフト / 添削）",
            description: "面接ログやカードから、ESの下書き作成／添削をします。",
            href: "/es",
            completed: step4Completed,
          },
          {
            id: 5,
            title: "キャリアマッチ診断",
            description: "タイプ × 経験 × 志望業界のギャップと対策を分析します（順次拡張予定）。",
            href: "/diagnosis-16type",
            completed: step5Completed,
          },
        ]);

        // ✅ Usage Summary / META lots
        void fetchUsageSummary();
        void fetchActiveMetaLots();

        setChecking(false);
      } catch (e) {
        console.error(e);
        setError("読み込み中にエラーが発生しました。");
        setChecking(false);
      }
    };

    void run();
  }, [isClosed, supabase, router]);

  if (isClosed) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-6 text-slate-50">
        <div className="max-w-lg space-y-4 text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Mentor.AI Classroom</p>
          <h1 className="text-2xl font-semibold">このクラス用デモは終了しました</h1>
          <p className="text-sm leading-relaxed text-slate-300">
            本日の授業で利用した Mentor.AI クラス専用環境はクローズしました。
            <br />
            登録されたプロフィール・ストーリーカード・診断結果などのデータは、安全に保存されています。
          </p>
          <div className="mt-4 rounded-2xl border border-slate-700 bg-slate-900/60 px-4 py-3 text-left text-xs text-slate-300">
            <p className="mb-1 font-semibold text-slate-100">これからのご利用について</p>
            <ul className="list-inside list-disc space-y-1">
              <li>
                正式版リリース後、同じメールアドレス・パスワードで本番環境にログインすると、今回のデータをそのまま引き継いでご利用いただけます。
              </li>
              <li>詳細なご案内は、Mentor.AI 公式Instagramや授業内で今後お知らせ予定です。</li>
            </ul>
          </div>
          <p className="pt-2 text-[11px] text-slate-500">
            ご不明点があれば、授業担当の藤田先生 または 渡邉 までお問い合わせください。
          </p>
        </div>
      </main>
    );
  }

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="rounded-3xl bg-white/70 px-6 py-4 text-sm text-slate-600 shadow">
          ダッシュボードを準備しています…
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="rounded-3xl bg-rose-50 px-6 py-4 text-sm text-rose-700 shadow">{error}</div>
      </main>
    );
  }

  // ✅ 進捗%とロック解除条件は「必須STEPだけ」で計算（Step2=任意）
  const requiredSteps = baseSteps.filter((s) => REQUIRED_STEP_IDS.has(s.id));
  const completedCount = requiredSteps.filter((s) => s.completed).length;
  const totalSteps = requiredSteps.length;
  const progressPercent = totalSteps > 0 ? Math.round((completedCount / totalSteps) * 100) : 0;
  const allBaseStepsCompleted = requiredSteps.every((s) => s.completed);

  const esTotal = esDraftCount + esCorrectionCount;

  return (
    <main className="min-h-screen bg-sky-50/40">
      <div className="mx-auto max-w-5xl space-y-10 px-6 py-8">
        {/* ヘッダー */}
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-500">Mentor.AI</p>
          <h1 className="text-2xl font-semibold text-slate-900">あなたの成長ダッシュボード</h1>
          <p className="text-sm text-slate-600">最近の取り組みと、今日やると良い一歩をまとめています。</p>
        </header>

        {/* ✅ 次の一手（最上部に移動） */}
        <section className="space-y-3 rounded-3xl bg-white/90 p-5 shadow-sm shadow-sky-100">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-slate-900">次の一手（あなた向け）</h2>
            <Link
              href="/start"
              className="text-[11px] font-medium text-sky-700 underline underline-offset-2 hover:text-sky-800"
            ></Link>
          </div>
          <p className="text-[11px] text-slate-500">
            直近のログと進捗から、今日やると効くものを1〜2個だけ提案します。
          </p>

          <div className="grid gap-3 md:grid-cols-2">
            {nextActions.map((a, idx) => (
              <NextActionCard key={`${a.href}-${idx}`} action={a} />
            ))}
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => router.push("/start")}
              className="inline-flex items-center rounded-full bg-sky-500 px-4 py-1.5 text-xs font-medium text-white shadow-sm shadow-sky-200 hover:bg-sky-600"
            >
              まず何をすればいい？（スタートガイド） →
            </button>
            <button
              type="button"
              onClick={() => router.refresh?.()}
              className="text-[11px] font-medium text-sky-700 underline underline-offset-2 hover:text-sky-800"
            >
              ※提案を再読み込み
            </button>
          </div>
        </section>

        {/* ✅ 今月の無料枠（小さめ・邪魔しない） */}
        <section className="rounded-3xl bg-white/90 p-5 shadow-sm shadow-sky-100">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">今月の無料枠</h2>
              <p className="text-[11px] text-slate-500">無料枠を超えると META で続行できます。</p>
            </div>
            <button
              type="button"
              onClick={() => fetchUsageSummary()}
              className="text-[11px] font-medium text-sky-700 underline underline-offset-2 hover:text-sky-800"
            >
              {usageLoading ? "更新中…" : "更新"}
            </button>
          </div>

          {!usage ? (
            <div className="mt-3 text-xs text-slate-500">利用状況を読み込み中…</div>
          ) : usage.plan === "pro" ? (
            <div className="mt-3 rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-3 text-sm text-emerald-800">
              Proプラン：主要機能は <span className="font-semibold">無制限</span> です ✅
            </div>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {usage.items.slice(0, 6).map((it) => (
                <UsageCard key={it.feature} item={it} />
              ))}
            </div>
          )}
        </section>

        {/* ✅ METAの内訳（期限付きロット一覧） */}
        <section className="rounded-3xl bg-white/90 p-5 shadow-sm shadow-sky-100">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">利用可能なMETAの内訳</h2>
              <p className="text-[11px] text-slate-500">有効期限が近いMETAから自動で消費されます。</p>
            </div>

            <button
              type="button"
              onClick={() => fetchActiveMetaLots()}
              className="text-[11px] font-medium text-sky-700 underline underline-offset-2 hover:text-sky-800"
            >
              {metaLotsLoading ? "更新中…" : "更新"}
            </button>
          </div>

          <MetaLotsTable lots={metaLots} loading={metaLotsLoading} />
        </section>

        {/* 上段：進捗サマリー */}
        <section className="space-y-4 rounded-3xl bg-gradient-to-br from-sky-50 via-white to-sky-100/70 p-5 shadow-sm shadow-sky-100">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-sky-600">就活の“基礎づくり”の進捗</p>
              <p className="text-xs text-slate-500">
                プロフィール・AI思考タイプ診断・一般面接（10問）など、土台の進み具合です。
              </p>
            </div>
            <p className="text-sm font-semibold text-sky-700">
              {progressPercent}
              <span className="text-xs font-normal text-slate-500"> % 完了</span>
            </p>
          </div>

          <div className="h-2 w-full rounded-full bg-sky-100/80">
            <div className="h-2 rounded-full bg-sky-500 transition-[width]" style={{ width: `${progressPercent}%` }} />
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <SummaryCard
              label="基礎STEP 完了数"
              value={`${completedCount}/${totalSteps}`}
              helper="まずはプロフィール→一般面接→ES→キャリア診断が土台です（AIタイプ診断は任意）。"
            />
            <SummaryCard
              label="一般面接（10問）"
              value={`${interview10Count}`}
              helper="1セッション増えるほど、ES・面接が一気に楽になります。"
            />
            <SummaryCard
              label="ES（合計）"
              value={`${esTotal}`}
              helper={`ドラフト：${esDraftCount} ／ 添削：${esCorrectionCount}`}
            />
          </div>
        </section>

        {/* 直近アクティビティ */}
        <section className="space-y-3 rounded-3xl bg-white/90 p-5 shadow-sm shadow-sky-100">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-slate-900">直近アクティビティ</h2>
            <Link href="/growth" className="text-[11px] font-medium text-sky-700 underline underline-offset-2 hover:text-sky-800">
              すべて見る →
            </Link>
          </div>
          <p className="text-[11px] text-slate-500">Growth Inbox の直近5件です。</p>

          {recentLogs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-6 text-center text-sm text-slate-500">
              まだアクティビティがありません。
              <br />
              まずは一般面接（10問）や診断を試してみてください。
            </div>
          ) : (
            <ul className="space-y-2">
              {recentLogs.map((log) => {
                const meta = SOURCE_LABEL[log.source] ?? { label: "その他", emoji: "✨" };
                return (
                  <li key={log.id} className="rounded-2xl border border-slate-100 bg-white/95 px-4 py-3 text-sm shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{meta.emoji}</span>
                        <span className="text-[11px] font-medium text-slate-500">{meta.label}</span>
                      </div>
                      <span className="text-[11px] text-slate-400">{formatJpShort(log.created_at)}</span>
                    </div>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{log.title}</p>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* 基礎STEP */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">基礎セット（土台づくりのチェックリスト）</h2>
            <p className="text-[11px] text-slate-500">いつでもここから見直せます。</p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {baseSteps.map((step) => (
              <BaseStepCard key={step.id} step={step} />
            ))}
          </div>
        </section>

        {/* 応用ツール */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">応用ツール（スキルを鍛える）</h2>
            <div className="flex items-center gap-2 text-[11px] text-slate-500">
              {!allBaseStepsCompleted ? (
                <>
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 text-[9px]">
                    🔒
                  </span>
                  <span>基礎セット（必須）を終えると、すべてのツールが解放されます</span>
                </>
              ) : (
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                  すべての応用ツールが解放されています
                </span>
              )}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <AdvancedToolCard
              title="ケース面接AI"
              description="戦略コンサル・投資銀行向けのケース問題をAIと練習できます。"
              href="/case"
              locked={!allBaseStepsCompleted}
            />
            <AdvancedToolCard
              title="フェルミ推定AI"
              description="フェルミ推定の思考プロセスを一緒に分解しながらトレーニングします。"
              href="/fermi"
              locked={!allBaseStepsCompleted}
            />
            <AdvancedToolCard
              title="AI思考力トレーニング"
              description="AIを使ってどう考えるかを練習しながら、思考ログを貯められます。"
              href="/mentor-ai-index"
              locked={!allBaseStepsCompleted}
            />
            <AdvancedToolCard
              title="企業研究"
              description="あなたのタイプ・経験に基づいて、志望業界とのフィット感を解説します。"
              href="/industry"
              locked={!allBaseStepsCompleted}
            />
          </div>
        </section>

        {/* ✅ Mentor.AI 推奨の使い方（下の方に追加） */}
        <section className="rounded-3xl border border-sky-100 bg-white/90 p-5 shadow-sm shadow-sky-100">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-slate-900">Mentor.AI 推奨の使い方</h2>
              <p className="text-[11px] leading-relaxed text-slate-500">
                迷ったらこの順番。最短で「ES・面接で使える成果物」に変換するためのガイドです。
              </p>
            </div>
            <Link
              href="/start"
              className="shrink-0 text-[11px] font-medium text-sky-700 underline underline-offset-2 hover:text-sky-800"
            >
              ガイドへ →
            </Link>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl bg-slate-50/70 px-4 py-3">
              <p className="text-[11px] font-semibold text-slate-700">1) 素材化</p>
              <p className="mt-1 text-[11px] text-slate-500">一般面接10問で経験を「話して」ログにする</p>
            </div>
            <div className="rounded-2xl bg-slate-50/70 px-4 py-3">
              <p className="text-[11px] font-semibold text-slate-700">2) 成果物化</p>
              <p className="mt-1 text-[11px] text-slate-500">ESドラフト/添削で提出物に変換する</p>
            </div>
            <div className="rounded-2xl bg-slate-50/70 px-4 py-3">
              <p className="text-[11px] font-semibold text-slate-700">3) 最適化</p>
              <p className="mt-1 text-[11px] text-slate-500">志望業界の勝ち筋（インサイト/診断）で精度を上げる</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => router.push("/start")}
              className="inline-flex items-center rounded-full bg-sky-500 px-4 py-1.5 text-xs font-medium text-white shadow-sm shadow-sky-200 hover:bg-sky-600"
            >
              推奨フローを確認する →
            </button>
            <Link
              href="/start"
              className="text-[11px] font-medium text-sky-700 underline underline-offset-2 hover:text-sky-800"
            >
              迷ったらここ（/start）
            </Link>
          </div>
        </section>

        {/* フッター */}
        <section className="mt-10 border-t pt-6 text-xs text-slate-600">
          <h2 className="mb-2 text-sm font-semibold">運営者情報</h2>
          <p>運営：Mentor.AI</p>
          <p>所在地：〒104-0061 東京都中央区銀座一丁目22番11号 銀座大竹ビジデンス 2F</p>
          <p>お問い合わせ：support@mentor-ai.net</p>
          <p className="mt-2">
            特定商取引法に基づく表記は{" "}
            <Link href="/legal" className="underline">
              こちら
            </Link>
            をご覧ください。
          </p>
        </section>
      </div>
    </main>
  );
}

// ------------------------------
// Components
// ------------------------------
function UsageCard({ item }: { item: UsageSummaryItem }) {
  const pct = item.freeLimit > 0 ? Math.round((item.usedThisMonth / item.freeLimit) * 100) : 0;
  const remaining = Math.max(0, item.remaining);

  return (
    <div className="rounded-2xl bg-white/90 px-4 py-3 shadow-sm shadow-sky-100">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium text-slate-600">
          {item.emoji ? <span className="mr-1">{item.emoji}</span> : null}
          {item.label}
        </p>
        <p className="text-[11px] text-slate-400">
          {remaining} / {item.freeLimit}
        </p>
      </div>
      <div className="mt-2 h-2 w-full rounded-full bg-slate-100">
        <div className="h-2 rounded-full bg-sky-500" style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <p className="mt-2 text-[11px] text-slate-500">
        今月 {item.usedThisMonth}回利用（残り{remaining}回）
      </p>
    </div>
  );
}

type SummaryCardProps = { label: string; value: string; helper: string };

function SummaryCard({ label, value, helper }: SummaryCardProps) {
  return (
    <div className="rounded-2xl bg-white/80 px-4 py-3 shadow-sm shadow-sky-100">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p>
      <p className="mt-1 whitespace-pre-line text-[11px] text-slate-500">{helper}</p>
    </div>
  );
}

function BaseStepCard({ step }: { step: BaseStep }) {
  return (
    <div className="flex flex-col justify-between rounded-2xl bg-white/90 p-4 shadow-sm shadow-sky-100">
      <div className="space-y-1">
        <div className="mb-1 flex items-center justify-between">
          <p className="text-[11px] font-semibold text-sky-500">STEP {step.id}</p>
          <div className="flex items-center gap-2">
            {step.badge && (
              <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-600">
                {step.badge}
              </span>
            )}
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] ${
                step.completed ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
              }`}
            >
              {step.completed ? "完了" : "未完了"}
            </span>
          </div>
        </div>
        <h3 className="text-sm font-semibold text-slate-900">{step.title}</h3>
        <p className="text-xs text-slate-600">{step.description}</p>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs">
        <Link
          href={step.href}
          className={`inline-flex items-center rounded-full px-4 py-1.5 font-medium transition ${
            step.completed
              ? "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              : "bg-sky-500 text-white shadow-sm shadow-sky-200 hover:bg-sky-600"
          }`}
        >
          {step.completed ? "確認・編集する" : "進める →"}
        </Link>
      </div>
    </div>
  );
}

function NextActionCard({ action }: { action: NextAction }) {
  return (
    <div className="flex flex-col justify-between rounded-2xl border border-slate-100 bg-white/95 p-4 shadow-sm shadow-sky-100">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-slate-900">提案</p>
          {action.badge && (
            <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-600">
              {action.badge}
            </span>
          )}
        </div>
        <h3 className="text-sm font-semibold text-slate-900">{action.title}</h3>
        <p className="text-xs leading-relaxed text-slate-600">{action.reason}</p>
      </div>

      <div className="mt-3">
        <Link
          href={action.href}
          className="inline-flex items-center rounded-full bg-sky-500 px-4 py-1.5 text-xs font-medium text-white shadow-sm shadow-sky-200 hover:bg-sky-600"
        >
          これをやる →
        </Link>
      </div>
    </div>
  );
}

type AdvancedToolCardProps = { title: string; description: string; href: string; locked: boolean };

function AdvancedToolCard({ title, description, href, locked }: AdvancedToolCardProps) {
  return (
    <div
      className={`relative flex flex-col justify-between rounded-2xl bg-white/90 p-4 shadow-sm shadow-sky-100 ${
        locked ? "opacity-60" : ""
      }`}
    >
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          {locked && (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">
              🔒 ロック中
            </span>
          )}
        </div>
        <p className="text-xs text-slate-600">{description}</p>
      </div>

      <div className="mt-3">
        {locked ? (
          <button
            className="inline-flex cursor-not-allowed items-center rounded-full bg-slate-100 px-4 py-1.5 text-xs font-medium text-slate-400"
            type="button"
          >
            基礎セット（必須）をすべて終えると解放されます
          </button>
        ) : (
          <Link
            href={href}
            className="inline-flex items-center rounded-full bg-sky-500 px-4 py-1.5 text-xs font-medium text-white shadow-sm shadow-sky-200 hover:bg-sky-600"
          >
            使ってみる →
          </Link>
        )}
      </div>
    </div>
  );
}

// ✅ META lots table
function MetaLotsTable({ lots, loading }: { lots: MetaLot[]; loading: boolean }) {
  const total = lots.reduce((sum, l) => sum + (Number(l.remaining) || 0), 0);

  if (loading && lots.length === 0) {
    return <div className="mt-3 text-xs text-slate-500">読み込み中…</div>;
  }

  if (!loading && lots.length === 0) {
    return (
      <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-6 text-center text-sm text-slate-500">
        現在利用可能なMETAはありません。
      </div>
    );
  }

  return (
    <div className="mt-4">
      {/* 合計 */}
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[11px] text-slate-500">期限が近い順に表示しています</p>
        <p className="text-sm font-semibold text-slate-900">
          合計 <span className="tabular-nums">{total}</span> META
        </p>
      </div>

      <div className="divide-y divide-slate-100 rounded-2xl border border-slate-100 bg-white/95">
        {lots.map((lot) => {
          const d = daysUntil(lot.expires_at);
          return (
            <div key={lot.id} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="text-lg">{expiryBadge(d)}</div>
                <div>
                  <div className="text-sm font-medium text-slate-900">{formatDateJP(lot.expires_at)} まで</div>
                  <div className="text-[11px] text-slate-500">
                    {sourceLabel(lot.source)} ・あと {d} 日
                  </div>
                </div>
              </div>
              <div className="text-sm font-semibold text-slate-900 tabular-nums">{lot.remaining} META</div>
            </div>
          );
        })}
      </div>

      <div className="mt-2 text-[11px] text-slate-500">🔴 7日以内 / 🟠 30日以内 / 🟢 それ以降</div>
    </div>
  );
}
