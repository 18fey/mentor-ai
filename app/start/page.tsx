// app/start/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

type Purpose = "job_hunting" | "thinking_training";
type JobStage = "just_starting" | "es_phase" | "interview_phase";

type ProfileRow = {
  id: string;
  purpose: Purpose | null;
  job_stage: JobStage | null;
  onboarding_completed: boolean | null;
  first_run_completed: boolean | null;
};

const FLOW_ITEMS = [
  {
    step: "①",
    title: "プロフィール → 一般面接 → ES添削",
    caption: "まずは“あなたという素材”を正しく言語化する",
    description:
      "オンボーディングで入力してもらったプロフィールやAI思考タイプ診断の内容をもとに、一般面接であなたのストーリーを言語化します。その回答をそのまま ES 添削に活かしていく流れです。",
  },
  {
    step: "②",
    title: "AI思考タイプ診断 → 業界マッチング",
    caption: "AIが教える“あなたの強みの使い方 × 業界との相性”",
    description:
      "すでに診断済みの AI思考タイプを出発点に、どのような業界・働き方と相性が良いのかを整理していきます。「どこで戦うと自分らしさが活きるか？」を俯瞰するステップです。",
  },
  {
    step: "③",
    title: "企業研究で気になる企業を見る",
    caption: "就活全体のマップを“企業ベース”で見渡す",
    description:
      "志望業界や気になっている企業について、事業内容・ビジネスモデル・どんな人が活躍しているかなどの基本情報をキャッチアップします。“なんとなく志望”を“ちゃんと見えている”状態に近づけます。",
  },
];

// ✅ Client Component 用 Supabase クライアント（@supabase/ssr）
const createSupabaseClient = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

export default function StartPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);

      const supabase = createSupabaseClient();

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        console.error(userError);
      }

      if (!user) {
        router.replace("/auth?redirectTo=/start");
        return;
      }

      const { data, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profileError) {
        console.error(profileError);
        setError("プロフィール情報の取得に失敗しました。時間をおいて再度お試しください。");
        setLoading(false);
        return;
      }

      const p = data as ProfileRow;

      // オンボーディング未完了 → /onboarding へ戻す
      if (!p.onboarding_completed) {
        router.replace("/onboarding");
        return;
      }

      // すでにスタート画面を完了済みならホームへ
      

      setProfile(p);
      setLoading(false);
    };

    load();
  }, [router]);

  const handleStartInterview = async () => {
    if (!profile) return;
    setSaving(true);
    setError(null);

    const supabase = createSupabaseClient();

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ first_run_completed: true })
      .eq("id", profile.id);

    if (updateError) {
      console.error(updateError);
      setError("開始フローの保存に失敗しました。時間をおいて再度お試しください。");
      setSaving(false);
      return;
    }

    router.push("/general");// 実際の一般面接ページに合わせて調整
  };

  const handleSkip = async () => {
    if (!profile) return;
    setSaving(true);
    setError(null);

    const supabase = createSupabaseClient();

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ first_run_completed: true })
      .eq("id", profile.id);

    if (updateError) {
      console.error(updateError);
      setError("スキップの保存に失敗しました。時間をおいて再度お試しください。");
      setSaving(false);
      return;
    }

    router.push("/");
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-[#F5FAFF] to-white flex items-center justify-center">
        <div className="text-sm text-slate-500">
          あなた専用のスタート画面を準備しています...
        </div>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-[#F5FAFF] to-white flex items-center justify-center">
        <div className="rounded-xl bg-white/80 px-6 py-4 shadow-sm border border-slate-100 text-sm text-slate-600">
          スタート画面の表示に必要な情報が取得できませんでした。ログインし直してお試しください。
        </div>
      </main>
    );
  }

  const purposeLabel: string =
    profile.purpose === "thinking_training"
      ? "思考トレーニングモード"
      : "就活モード";

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#F5FAFF] to-white">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:py-14">
        {/* ヘッダー */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium tracking-[0.25em] text-slate-500 uppercase">
              Mentor.AI / Getting Started
            </p>
            <h1 className="mt-2 text-2xl sm:text-3xl font-semibold text-slate-900">
              今日は、
              <span className="bg-gradient-to-r from-sky-500 to-indigo-500 bg-clip-text text-transparent">
                就活全体を一望できる
              </span>
              体験フローから始めましょう。
            </h1>
            <p className="mt-2 text-sm text-slate-600 max-w-2xl">
              オンボーディングで入力したプロフィールと AI思考タイプ診断をもとに、
              「まず何から始めればいいか」を授業と同じフローで案内します。
              ここを1周すると、Mentor.AI の全体像と自分の現在地がかなりクリアになります。
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-medium text-slate-700 shadow-sm">
              {purposeLabel}
            </span>
          </div>
        </div>

        {/* まずAI思考タイプ診断が済んでいる前提の説明 */}
        <section className="mb-6 rounded-2xl border border-slate-100 bg-white/85 px-4 py-4 sm:px-6 sm:py-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">
            オンボーディングで終えたこと
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            すでに以下の準備は完了しています。この土台の上に、今日の体験フローを載せていきます。
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-3">
              <p className="text-xs font-semibold text-slate-800 mb-1.5">
                ✅ プロフィール入力
              </p>
              <p className="text-[11px] leading-relaxed text-slate-600">
                学年・ステータス・志望業界などの基本情報。今後のレコメンドや「どこから始めるか」の判断に使われます。
              </p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-3">
              <p className="text-xs font-semibold text-slate-800 mb-1.5">
                ✅ AI思考タイプ診断
              </p>
              <p className="text-[11px] leading-relaxed text-slate-600">
                あなたの思考のクセや、AIとの相性が出ています。業界マッチングや思考トレーニングの設計に活かしていきます。
              </p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-3">
              <p className="text-xs font-semibold text-slate-800 mb-1.5">
                ✅ 志望業界・興味の方向性
              </p>
              <p className="text-[11px] leading-relaxed text-slate-600">
                「なんとなく興味がある業界」「今見ている企業」の情報を、企業研究や質問テーマの優先順位づけに使います。
              </p>
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={() => router.push("/profile")}
              className="text-[11px] font-medium text-sky-700 hover:text-sky-800 underline underline-offset-2"
            >
              プロフィールを編集する
            </button>
          </div>
        </section>

        {/* 中央の「今日の体験フロー」説明 */}
        <section className="mb-6 rounded-2xl border border-slate-100 bg-white/90 px-4 py-5 sm:px-6 sm:py-6 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                この流れで行うと、自分の現在地がわかります。
              </h2>
              <p className="mt-1 text-[11px] text-slate-600">
               
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {FLOW_ITEMS.map((item) => (
              <div
                key={item.step}
                className="flex gap-3 rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-3"
              >
                <div className="mt-0.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white shadow-sm text-[11px] font-semibold text-slate-700">
                    {item.step}
                  </span>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-900">
                    {item.title}
                  </p>
                  <p className="text-[11px] text-sky-700 font-medium mt-0.5">
                    「{item.caption}」
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}

            {/* ④ 余裕があれば */}
            <div className="flex gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-3 py-3">
              <div className="mt-0.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white shadow-sm text-[11px] font-semibold text-slate-500">
                  ④
                </span>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-900">
                  時間が余ったら：面接練習 & ケース問題（フェルミ含む）
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
                  一般面接やESで整理した内容をもとに、「深掘りされても耐えられるか」「初見のテーマでもどこまで考えられるか」を試してみたい人向けのステップです。
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 下段：具体的な入り口ボタン群 */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2.2fr)]">
          {/* 左：今日の一歩（一般面接） */}
          <section className="rounded-2xl border border-slate-100 bg-white/95 p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900 flex items-center justify-between">
              今日の一歩は、ここからがおすすめ
              <span className="rounded-full bg-slate-50 px-2.5 py-0.5 text-[10px] font-medium text-slate-500">
                ① プロフィール → 一般面接 → ES添削
              </span>
            </h2>

            <div className="mt-4 rounded-xl border border-slate-100 bg-gradient-to-br from-sky-50/85 to-indigo-50/80 p-4">
              <p className="text-xs font-semibold text-sky-800 mb-1">
                一般面接で “素材の棚卸し” をしてみましょう
              </p>
              <h3 className="text-lg font-semibold text-slate-900">
                まずは一般面接の質問に 10問答えて、STAR構造の経験カードを自動生成します。
              </h3>
              <p className="mt-2 text-xs text-slate-700 leading-relaxed">
                いきなり完璧なESを書くのではなく、
                「話し言葉ベースで、自分の経験や考えを出し切る」ところから始めます。
                ここで出てきた回答は、そのまま ES 添削に転用していくことができます。
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleStartInterview}
                  className="inline-flex items-center justify-center rounded-full bg-sky-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-sky-700 disabled:opacity-70 disabled:hover:bg-sky-600"
                >
                  {saving ? "はじめる準備中..." : "一般面接（10問）からはじめる"}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSkip}
                  className="text-[11px] font-medium text-slate-500 hover:text-slate-700"
                >
                  スタート画面をスキップしてホームへ進む
                </button>
              </div>
            </div>

            {/* 他の入り口 */}
            <div className="mt-5">
              <p className="text-[11px] font-medium text-slate-500 mb-2">
                ほかのステップから始めてみたい場合
              </p>
              <div className="flex flex-wrap gap-2 text-[11px]">
                <button
                  type="button"
                  onClick={() => router.push("/es")}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-600 hover:border-sky-200 hover:text-sky-700"
                >
                  ES をつくってみる
                </button>
                <button
                  type="button"
                  onClick={() => router.push("/diagnosis-16type")}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-600 hover:border-sky-200 hover:text-sky-700"
                >
                  業界マッチングを見る
                </button>
                <button
                  type="button"
                  onClick={() => router.push("/industry")}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-600 hover:border-sky-200 hover:text-sky-700"
                >
                  企業研究を開く
                </button>
                <button
                  type="button"
                  onClick={() => router.push("diagnosis-16type")}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-600 hover:border-sky-200 hover:text-sky-700"
                >
                  AI思考タイプ診断の結果を見る
                </button>
              </div>
            </div>
          </section>

          {/* 右：④用の入り口（面接・ケース・フェルミ） */}
          <section className="rounded-2xl border border-slate-100 bg-white/95 p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">
              時間が余ったら試してみたいステップ（④）
            </h2>
            <p className="mt-1 text-[11px] text-slate-600">
              ①〜③が一通り終わったあと、「もっと鍛えたい」と思った方向けのメニューです。
            </p>

            <div className="mt-4 space-y-3">
              <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-3">
                <p className="text-xs font-semibold text-slate-900">
                  一般面接の追加練習をする
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
                  回答の深さや一貫性を高めていきたいときに。
                  同じ質問にもう一度答えてみるのも、新しい質問に挑戦してみるのもOKです。
                </p>
                <button
                  type="button"
                  onClick={() => router.push("/general")}
                  className="mt-2 text-[11px] font-medium text-sky-700 hover:text-sky-800 underline underline-offset-2"
                >
                  面接練習ページを開く
                </button>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-3">
                <p className="text-xs font-semibold text-slate-900">
                  ケース問題・フェルミ推定を試してみる
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
                  コンサル・総合職・企画系などでよく聞かれる、
                  「初見のお題に対して、どう構造的に考えるか」を鍛えるモードです。
                  1問だけでも十分トレーニングになります。
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => router.push("/case")}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] text-slate-600 hover:border-sky-200 hover:text-sky-700"
                  >
                    ケース問題をやってみる
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push("/fermi")}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] text-slate-600 hover:border-sky-200 hover:text-sky-700"
                  >
                    フェルミ推定をやってみる
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-100 bg-red-50/80 px-4 py-3 text-xs text-red-700">
            {error}
          </div>
        )}
      </div>
    </main>
  );
}
