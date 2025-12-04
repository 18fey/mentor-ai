// app/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import Link from "next/link";

type Database = any;

type BaseStepId = 1 | 2 | 3 | 4 | 5;

type BaseStep = {
  id: BaseStepId;
  title: string;
  description: string;
  href: string;
  completed: boolean;
  badge?: string;
};

// ★ 追加：APP_MODE を環境変数から取得（なければ production 扱い）
const APP_MODE = process.env.NEXT_PUBLIC_APP_MODE || "production";

export default function HomePage() {
  // ★ 追加：クローズモードならここで早期リターン
  if (APP_MODE === "closed") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-slate-950 text-slate-50 px-6">
        <div className="max-w-lg text-center space-y-4">
          <p className="text-xs tracking-[0.2em] uppercase text-slate-400">
            Mentor.AI Classroom
          </p>
          <h1 className="text-2xl font-semibold">
            このクラス用デモは終了しました
          </h1>
          <p className="text-sm text-slate-300 leading-relaxed">
            本日の授業で利用した Mentor.AI クラス専用環境はクローズしました。
            <br />
            登録されたプロフィール・ストーリーカード・診断結果などのデータは、
            安全に保存されています。
          </p>
          <div className="mt-4 rounded-2xl bg-slate-900/60 border border-slate-700 px-4 py-3 text-xs text-left text-slate-300">
            <p className="font-semibold text-slate-100 mb-1">
              これからのご利用について
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>
                正式版リリース後、同じメールアドレス・パスワードで本番環境にログインすると、
                今回のデータをそのまま引き継いでご利用いただけます。
              </li>
              <li>
                詳細なご案内は、Mentor.AI
                公式Instagramや授業内で今後お知らせ予定です。
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

  // ★ ここから下は元の HomePage ロジックそのまま
  const supabase = createClientComponentClient<Database>();
  const router = useRouter();

  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // とりあえずフロント側だけで完了状態を管理
  // 今は「オンボ完了＝STEP1・2は完了」とみなす
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
          .select("onboarding_completed")
          .eq("id", user.id)
          .maybeSingle();

        if (profileError) {
          console.error(profileError);
          setError("プロフィールの読み込みに失敗しました。");
          setChecking(false);
          return;
        }

        if (!profile || !profile.onboarding_completed) {
          router.push("/onboarding");
          return;
        }

        // ★ 今は暫定ロジック：
        //   STEP1,2 = オンボ済みなので完了扱い
        //   STEP3〜5 = 未完了（のちほど Supabase の値で上書きする想定）
        const initialSteps: BaseStep[] = [
          {
            id: 1,
            title: "プロフィール",
            description:
              "大学・学部・志望業界など、AIが最適化するための前提を入力します",
            href: "/profile",
            completed: true,
          },
          {
            id: 2,
            title: "AI思考タイプ診断",
            description: "10問であなたのAI活用スタイルを診断します（16タイプ）",
            href: "/diagnosis-16type",
            completed: true,
          },
          {
            id: 3,
            title: "ストーリーカードを1つ作る",
            description:
              "10問の一般面接AIから、STAR構造の経験カードを自動生成します",
            href: "/general", // 後で /story-card などに差し替え
            completed: false,
            badge: "推奨",
          },
          {
            id: 4,
            title: "ESドラフト",
            description: "作ったカードから、ESの下書きを自動生成します",
            href: "/es",
            completed: false,
          },
          {
            id: 5,
            title: "キャリアマッチ診断",
            description: "タイプ × 経験 × 志望業界のギャップと対策を分析します",
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

    run();
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
      <div className="mx-auto max-w-5xl px-6 py-8 space-y-10">
        {/* ヘッダー */}
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-500">
            Mentor.AI
          </p>
          <h1 className="text-2xl font-semibold text-slate-900">
            あなたの就活スタートガイド
          </h1>
          <p className="text-sm text-slate-600">
            Mentor.AI が、あなたが迷わず進むための最短ルートを案内します。
          </p>
        </header>

        {/* 進捗バー & サマリー */}
        <section className="space-y-4 rounded-3xl bg-gradient-to-br from-sky-50 via-white to-sky-100/70 p-5 shadow-sm shadow-sky-100">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-sky-600">基礎STEP進捗</p>
              <p className="text-xs text-slate-500">
                {completedCount}/{totalSteps} STEP 完了
              </p>
            </div>
            <p className="text-sm font-semibold text-sky-700">
              {progressPercent}
              <span className="text-xs font-normal text-slate-500"> %</span>
            </p>
          </div>

          <div className="h-2 w-full rounded-full bg-sky-100/80">
            <div
              className="h-2 rounded-full bg-sky-500 transition-[width]"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* 上部サマリーカード */}
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <SummaryCard
              label="ストーリーカード"
              value="0"
              helper="まずは1枚作ってみましょう"
            />
            <SummaryCard
              label="ES下書き"
              value="0"
              helper="カードから自動生成できます"
            />
            <SummaryCard
              label="完了STEP"
              value={`${completedCount}/${totalSteps}`}
              helper="5つ揃うと応用ステップが開きます"
            />
          </div>
        </section>

        {/* 基礎STEP */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">
              基礎STEP（必須）
            </h2>
            <p className="text-[11px] text-slate-500">
              プロフィールとAIタイプ診断はオンボード時点で完了済みです
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {baseSteps.map((step) => (
              <BaseStepCard key={step.id} step={step} />
            ))}
          </div>
        </section>

        {/* 応用ステップ（ロック制御） */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">
              応用ステップ（スキルを鍛える）
            </h2>
            <div className="flex items-center gap-2 text-[11px] text-slate-500">
              {!allBaseStepsCompleted && (
                <>
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 text-[9px]">
                    🔒
                  </span>
                  <span>基礎STEP（5つ）が完了すると利用できます</span>
                </>
              )}
              {allBaseStepsCompleted && (
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                  すべての応用ステップが解放されました
                </span>
              )}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <AdvancedToolCard
              title="ケース面接AI"
              description="戦略コンサル・投資銀行向けのケース問題をAIと練習できます"
              href="/case"
              locked={!allBaseStepsCompleted}
            />
            <AdvancedToolCard
              title="フェルミ推定AI"
              description="フェルミ推定の思考プロセスを一緒に分解しながらトレーニングします"
              href="/fermi"
              locked={!allBaseStepsCompleted}
            />
            <AdvancedToolCard
              title="一般面接AI（模擬）"
              description="一次〜最終面接の想定質問を、リアルな対話形式で練習できます"
              href="/general"
              locked={!allBaseStepsCompleted}
            />
            <AdvancedToolCard
              title="業界インサイト"
              description="あなたのタイプ・経験に基づいて、志望業界とのフィット感を解説します"
              href="/industry"
              locked={!allBaseStepsCompleted}
            />
          </div>
        </section>

        {/* 今日のおすすめタスク */}
        <section className="mt-6 rounded-3xl bg-white/80 p-5 shadow-sm shadow-sky-100">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">
            今日のおすすめタスク
          </h2>
          <ul className="space-y-2 text-sm text-slate-700">
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
              プロフィールの内容を最新の志望業界・企業にアップデートする
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
              ストーリーカードを1枚だけ作ってみる（10分）
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
              作ったカードからESドラフトを1本生成してみる
            </li>
          </ul>
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
        <div className="mb-1 flex items中心 justify-between">
          <p className="text-[11px] font-semibold text-sky-500">
            STEP {step.id}
          </p>
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
        <h3 className="text-sm font-semibold text-slate-900">
          {step.title}
        </h3>
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
          {step.completed ? "変更する" : "進める →"}
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
            基礎STEPをすべて終えると解放されます
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
