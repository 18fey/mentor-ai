// components/FermiGuide.tsx
"use client";

import React from "react";

export const FermiGuide: React.FC = () => {
  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <header className="space-y-2">
        <p className="text-xs font-semibold text-sky-600 uppercase tracking-wide">
          Guide
        </p>
        <h1 className="text-2xl font-bold tracking-tight">
          フェルミ推定とは？（はじめての人向けガイド）
        </h1>
        <p className="text-sm text-slate-600">
          「よく分からない数字を、それっぽく論理で出してみるゲーム」です。
          正確な答えよりも、考え方・分け方・説明の仕方が評価されます。
        </p>
      </header>

      {/* 30秒サマリー */}
      <section className="rounded-xl border border-sky-100 bg-sky-50 p-4 space-y-2">
        <h2 className="text-sm font-semibold text-sky-700">
          🏁 30秒で分かるフェルミ
        </h2>
        <p className="text-sm text-slate-700">
          フェルミ推定は、
          <strong>①分ける → ②数字を置く → ③計算 → ④コメント</strong>
          の4ステップだけ覚えればOK。  
          「当てる」ゲームではなく、「どう考えたか」を見せるトレーニングです。
        </p>
      </section>

      {/* 4ステップ */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">フェルミの基本4ステップ</h2>
        <ol className="space-y-3 text-sm text-slate-700 list-decimal list-inside">
          <li>
            <strong>どう分けるか決める</strong>  
            いきなり数字を出さずに、
            「この問題って 何 × 何 で表せそう？」を考える。
          </li>
          <li>
            <strong>ざっくり数字を置く</strong>  
            正確じゃなくてOK。「だいたいこのくらいかな」という仮の数字を置く。
          </li>
          <li>
            <strong>計算する</strong>  
            置いた数字を使ってシンプルに計算する。
          </li>
          <li>
            <strong>コメントする</strong>  
            「実際はもう少し多そう」など、一言コメントを足すと一気にレベルが上がる。
          </li>
        </ol>
      </section>

      {/* 自販機の例（修正版） */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">超かんたん例：自動販売機の数</h2>
        <p className="text-sm text-slate-700">
          <strong>Q. 日本にある自動販売機の数は？</strong>
        </p>

        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2 text-sm text-slate-700">
          <p className="font-semibold text-slate-800">❌ よくあるわかりにくい例</p>
          <p>
            「30人に1台あると仮定する」など、
            <strong>人数ベース</strong>で考えると、自販機のイメージと結びつきにくく、
            初心者には少し分かりづらいことがあります。
          </p>
        </div>

        <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 space-y-2 text-sm text-slate-800">
          <p className="font-semibold">✅ わかりやすい考え方（場所ベース）</p>
          <ol className="space-y-2 list-decimal list-inside">
            <li>
              <strong>どこにあるかを思い出す</strong>  
              駅・コンビニ前・オフィス・住宅街・学校・高速道路のサービスエリア など、
              「置かれていそうな場所」をざっくり挙げる。
            </li>
            <li>
              <strong>エリアごとにざっくり数を置く</strong>  
              日本の市区町村は約1,700。  
              1つの市区町村に平均して{" "}
              <strong>200台くらい自販機がありそう</strong> と仮定。
            </li>
            <li>
              <strong>計算する</strong>  
              1,700 × 200 = 340,000台（約34万台）
            </li>
            <li>
              <strong>コメントをつける</strong>  
              「都市部はもっと多く、地方は少ないので、全体では
              <strong>40万〜60万台くらい</strong>になりそうです。」
            </li>
          </ol>
        </div>

        <p className="text-xs text-slate-500">
          大事なのは「本当にその数かどうか」ではなく、
          <strong>どう分解して、どう仮定したか</strong>です。
        </p>
      </section>

      {/* mentor.aiの使い方 */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">mentor.ai での進め方</h2>
        <ol className="space-y-2 text-sm text-slate-700 list-decimal list-inside">
          <li>問題文を読む（何を聞かれているかを確認）</li>
          <li>まず「どう分けるか」だけ書いてみる</li>
          <li>自分なりに数字を置いて計算してみる</li>
          <li>最後に一言コメントをつける</li>
          <li>AIのフィードバックと模範解答を見て、どこを改善できるか確認</li>
        </ol>
      </section>

      <div className="pt-2">
        <button
          className="inline-flex items-center rounded-lg border border-sky-500 px-4 py-2 text-sm font-medium text-sky-700 hover:bg-sky-50"
        >
          ▶︎ フェルミ問題で実際に試してみる
        </button>
      </div>
    </div>
  );
};
