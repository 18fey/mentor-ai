// app/page.tsx
"use client";

import { useEffect, useState } from "react";
import { redirect, useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";

type Database = any;

// Supabase クライアント生成ヘルパー
const createBrowserSupabaseClient = () =>
  createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

type SupabaseClient = ReturnType<typeof createBrowserSupabaseClient>;

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
  ai_type_key: string | null; // AI思考タイプ診断（ライト版）が入っていれば STEP2 完了
  first_run_completed: boolean | null; // /start を完了したかどうか
};

// ★ APP_MODE を環境変数から取得（なければ production）
const APP_MODE = process.env.NEXT_PUBLIC_APP_MODE || "production";

export default function HomePage() {
  redirect("/start");

  // ★ closed モードならここで早期リターン
  if (APP_MODE === "closed") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-6 text-slate-50">
        <div className="max-w-lg space-y-4 text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            Mentor.AI Classroom
          </p>
          <h1 className="text-2xl font-semibold">このクラス用デモは終了しました</h1>
          <p className="text-sm leading-relaxed text-slate-300">
            本日の授業で利用した Mentor.AI クラス専用環境はクローズしました。
            <br />
            登録されたプロフィール・ストーリーカード・診断結果などのデータは、
            安全に保存されています。
          </p>
          <div className="mt-4 rounded-2xl border border-slate-700 bg-slate-900/60 px-4 py-3 text-left text-xs text-slate-300">
            <p className="mb-1 font-semibold text-slate-100">
              これからのご利用について
            </p>
            <ul className="list-inside list-disc space-y-1">
              <li>
                正式版リリース後、同じメールアドレス・パスワードで本番環境にログインすると、
                今回のデータをそのまま引き継いでご利用いただけます。
              </li>
              <li>
                詳細なご案内は、Mentor.AI 公式Instagramや授業内で今後お知らせ予定です。
              </li>
            </ul>
          </div>
          <p className="pt-2 text-[11px] text-slate-500">
            ご不明点があれば、授業担当の藤田先生 または 渡邉 までお問い合わせください。
          </p>
        </div>
      </main>
    );
  }

  const supabase: SupabaseClient = createBrowserSupabaseClient();
  const router = useRouter();

  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [baseSteps, setBaseSteps] = useState<BaseStep[]>([]);

  useEffect(() => {
    const run = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push("/auth");
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

        // オンボ未完了なら Onboarding へ
        if (!profile || !profile.onboarding_completed) {
          router.push("/onboarding");
          return;
        }

        // ✅ オンボ完了済み・スタートガイド未完了なら /start へ
        if (!profile.first_run_completed) {
          router.push("/start");
          return;
        }

        const step1Completed = !!profile.onboarding_completed;
        const step2Completed = !!profile.ai_type_key;

        const initialSteps: BaseStep[] = [
          {
            id: 1,
            title: "プロフィール",
            description:
              "所属やステータス、志望業界など、AIが最適化するための前提を入力します。",
            href: "/profile",
            completed: step1Completed,
          },
          {
            id: 2,
            title: "AI思考タイプ診断",
            description:
              "直感アンケート10問で、あなたの「AIとの付き合い方」と思考スタイルを16タイプにマッピングします（オンボーディングで実施した診断をいつでも見直せます）。",
            href: "/onboarding/ai-typing",
            completed: step2Completed,
          },
          {
            id: 3,
            title: "ストーリーカードを1つ作る",
            description:
              "10問の一般面接AIから、STAR構造の経験カードを自動生成します。",
            href: "/general", // 後で /story-card などに差し替え可
            completed: false,
            badge: "推奨",
          },
          {
            id: 4,
            title: "ESドラフト",
            description: "作ったカードから、ESの下書きを自動生成します。",
            href: "/es",
            completed: false,
          },
          {
            id: 5,
            title: "キャリアマッチ診断",
            description:
              "タイプ × 経験 × 志望業界のギャップと対策を分析します（順次拡張予定）。",
            href: "/career-match", // まだなければダミー
            completed: false,
          },
        ];

        setBaseSteps(initialSteps);
        setChecking(false);
      } catch (e) {
        console.error(e);
        setError("読み込み中にエラーが発生しました。");
        setChecking(false);
      }
    };

    void run();
  }, [supabase, router]);

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
        <div className="rounded-3xl bg-rose-50 px-6 py-4 text-sm text-rose-700 shadow">
          {error}
        </div>
      </main>
    );
  }

  const completedCount = baseSteps.filter((s) => s.completed).length;
  const totalSteps = baseSteps.length;
  const progressRatio = completedCount / totalSteps;
  const progressPercent = Math.round(progressRatio * 100);
  const allBaseStepsCompleted = completedCount === totalSteps;

  return (
    <main className="min-h-screen bg-sky-50/40">
      <div className="mx-auto max-w-5xl space-y-10 px-6 py-8">
        {/* ヘッダー */}
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-500">
            Mentor.AI
          </p>
          <h1 className="text-2xl font-semibold text-slate-900">
            あなたの成長ダッシュボード
          </h1>
          <p className="text-sm text-slate-600">
            最近の取り組みと、今日やると良い一歩をまとめています。
            スタートガイド（/start）で決めたルートをベースに、
            「進捗の見える化」と「次の一手」の両方をここで管理できます。
          </p>
        </header>

        {/* 上段：進捗サマリー */}
        <section className="space-y-4 rounded-3xl bg-gradient-to-br from-sky-50 via-white to-sky-100/70 p-5 shadow-sm shadow-sky-100">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-sky-600">
                就活の“基礎づくり”の進捗
              </p>
              <p className="text-xs text-slate-500">
                プロフィール・AI思考タイプ診断・ストーリーカードなど、
                Mentor.AI を使いこなすための土台の進み具合です。
              </p>
            </div>
            <p className="text-sm font-semibold text-sky-700">
              {progressPercent}
              <span className="text-xs font-normal text-slate-500">
                {" "}
                % 完了
              </span>
            </p>
          </div>

          <div className="h-2 w-full rounded-full bg-sky-100/80">
            <div
              className="h-2 rounded-full bg-sky-500 transition-[width]"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* サマリーカード */}
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <SummaryCard
              label="基礎STEP 完了数"
              value={`${completedCount}/${totalSteps}`}
              helper="プロフィールとAI診断が終わっていれば土台はOKです。"
            />
            <SummaryCard
              label="ストーリーカード"
              value="0"
              helper="まずは1枚作っておくとES・面接が一気に楽になります。"
            />
            <SummaryCard
              label="ESドラフト"
              value="0"
              helper="カードから自動生成できます。"
            />
          </div>
        </section>

        {/* 中段：今日のおすすめアクション */}
        <section className="space-y-3 rounded-3xl bg-white/90 p-5 shadow-sm shadow-sky-100">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-slate-900">
              今日のおすすめアクション
            </h2>
            <button
              type="button"
              onClick={() => router.push("/start")}
              className="text-[11px] font-medium text-sky-700 underline underline-offset-2 hover:text-sky-800"
            >
              スタートガイドをもう一度見る
            </button>
          </div>
          <p className="text-[11px] text-slate-500">
            迷ったら、上から順に 1〜2 個だけでも OK。毎回完璧にこなす必要はありません。
          </p>

          <ul className="space-y-2 text-sm text-slate-700">
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-sky-400" />
              <span>
                プロフィールの内容を
                <span className="font-semibold">最新の志望業界・企業</span>
                にアップデートする
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-sky-400" />
              <span>
                一般面接AIで
                <span className="font-semibold">1つだけ経験を話してみて</span>
                、ストーリーカードの素材をつくる（10分）
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-sky-400" />
              <span>
                できあがったカードから
                <span className="font-semibold">ESドラフトを1本生成</span>
                してみる
              </span>
            </li>
          </ul>
        </section>

        {/* 基礎STEP セクション */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">
              基礎セット（土台づくりのチェックリスト）
            </h2>
            <p className="text-[11px] text-slate-500">
              スタートガイドでやった内容を、いつでもここから見直せます。
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {baseSteps.map((step) => (
              <BaseStepCard key={step.id} step={step} />
            ))}
          </div>
        </section>

        {/* 応用ツール一覧 */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">
              応用ツール（スキルを鍛える）
            </h2>
            <div className="flex items-center gap-2 text-[11px] text-slate-500">
              {!allBaseStepsCompleted && (
                <>
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 text-[9px]">
                    🔒
                  </span>
                  <span>基礎セットが終わると、すべてのツールが解放されます</span>
                </>
              )}
              {allBaseStepsCompleted && (
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
              title="一般面接AI（模擬）"
              description="一次〜最終面接の想定質問を、リアルな対話形式で練習できます。"
              href="/general"
              locked={!allBaseStepsCompleted}
            />
            <AdvancedToolCard
              title="業界インサイト"
              description="あなたのタイプ・経験に基づいて、志望業界とのフィット感を解説します。"
              href="/industry"
              locked={!allBaseStepsCompleted}
            />
          </div>
        </section>

        {/* フッター：運営者情報 */}
        <section className="mt-10 border-t pt-6 text-xs text-slate-600">
          <h2 className="mb-2 text-sm font-semibold">運営者情報</h2>
          <p>事業者名：渡邉 花鈴（屋号：Mentor.AI）</p>
          <p>
            所在地：〒104-0061 東京都中央区銀座一丁目22番11号 銀座大竹ビジデンス
            2F
          </p>
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


// ------------ サブコンポーネント ------------

type SummaryCardProps = {
  label: string;
  value: string;
  helper: string;
};

function SummaryCard({ label, value, helper }: SummaryCardProps) {
  return (
    <div className="rounded-2xl bg-white/80 px-4 py-3 shadow-sm shadow-sky-100">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p>
      <p className="mt-1 text-[11px] text-slate-500">{helper}</p>
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
                step.completed
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-slate-100 text-slate-500"
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

type AdvancedToolCardProps = {
  title: string;
  description: string;
  href: string;
  locked: boolean;
};

function AdvancedToolCard({
  title,
  description,
  href,
  locked,
}: AdvancedToolCardProps) {
  return (
    <div
      className={`relative flex flex-col justify-between rounded-2xl bg-white/90 p-4 shadow-sm shadow-sky-100 ${
        locked ? "opacity-60" : ""
      }`}
    >
      <div className="space-y-1">
        <div className="flex itemscenter justify-between">
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
            基礎セットをすべて終えると解放されます
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
