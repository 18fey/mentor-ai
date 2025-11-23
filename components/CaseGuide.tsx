// components/CaseGuide.tsx
"use client";

import React from "react";

export const CaseGuide: React.FC = () => {
  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <header className="space-y-2">
        <p className="text-xs font-semibold text-violet-600 uppercase tracking-wide">
          Guide
        </p>
        <h1 className="text-2xl font-bold tracking-tight">
          ケース面接とは？（はじめての人向けガイド）
        </h1>
        <p className="text-sm text-slate-600">
          ケース面接は、「もしあなたが経営者だったらどう考える？」を問う面接です。
          正解は1つではなく、<strong>考え方・構造化・説明の仕方</strong>が評価されます。
        </p>
      </header>

      {/* 30秒サマリー */}
      <section className="rounded-xl border border-violet-100 bg-violet-50 p-4 space-y-2">
        <h2 className="text-sm font-semibold text-violet-700">
          🏁 30秒で分かるケース面接
        </h2>
        <p className="text-sm text-slate-700">
          ケース面接は、
          <strong>
            ①課題を整理 → ②分解 → ③仮説 → ④打ち手 → ⑤優先順位
          </strong>
          の流れで考えればOK。  
          いきなりアイデアを連発するものではありません。
        </p>
      </section>

      {/* 基本フロー */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">ケースの基本5ステップ</h2>
        <ol className="space-y-2 text-sm text-slate-700 list-decimal list-inside">
          <li>
            <strong>課題の整理</strong>  
            何が問題なのか？売上？利益？シェア？をはっきりさせる。
          </li>
          <li>
            <strong>要素の分解</strong>  
            売上 = 客数 × 客単価 など、式にして分解する。
          </li>
          <li>
            <strong>仮説を立てる</strong>  
            「客数が落ちていそう」など、どこが効いていそうか当たりをつける。
          </li>
          <li>
            <strong>打ち手を出す</strong>  
            仮説に対応する具体的な施策を考える。
          </li>
          <li>
            <strong>優先順位をつける</strong>  
            効果と実現性を見て、「まずこれから」という一手を決める。
          </li>
        </ol>
      </section>

      {/* ファミレスの例（リアル寄り＋わかりやすく） */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">
          超かんたん例：ファミレスの売上を伸ばす
        </h2>

        <p className="text-sm text-slate-700">
          <strong>
            Q. 郊外にあるファミレスの売上が、ここ3ヶ月で20％落ちています。どう改善しますか？
          </strong>
        </p>

        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 text-sm text-slate-700">
          <p className="font-semibold text-slate-800">① 売上の分解</p>
          <p>売上 = 客数 × 客単価</p>
          <p>
            「最近ガラガラ」と言われているので、
            <strong>客数が落ちている</strong>と仮定して考え始める。
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 text-sm text-slate-700">
          <p className="font-semibold text-slate-800">② なぜ客数が減った？</p>
          <ul className="list-disc list-inside space-y-1">
            <li>近くに安いチェーン店ができた</li>
            <li>平日の夜に来る理由が弱い</li>
            <li>学生向けのメニュー・割引がない</li>
          </ul>
          <p>
            仮に、
            <strong>「平日の夜の学生・若者の来店が減っている」</strong>
            という仮説を置く。
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 text-sm text-slate-700">
          <p className="font-semibold text-slate-800">③ どんな打ち手が考えられる？</p>
          <ul className="list-disc list-inside space-y-1">
            <li>平日夜限定の学生セット（価格を少し下げる）</li>
            <li>ドリンクバー無料 or 時間延長</li>
            <li>Instagramで「学生歓迎ナイト」キャンペーン</li>
          </ul>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 text-sm text-slate-700">
          <p className="font-semibold text-slate-800">④ 優先順位をつける</p>
          <p>
            コストが低く、すぐに始められて、ターゲットに刺さるものとして
            <strong>「学生セット＋SNS告知」</strong>を
            最初の一手として提案する。
          </p>
        </div>

        <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 space-y-2 text-sm text-slate-800">
          <p className="font-semibold">✅ まとめ回答イメージ</p>
          <p>
            「売上減少の原因は、平日夜の学生・若者の来店が減少している点にあると考えました。
            そのため、平日夜限定の学生向けセットを導入し、SNSでの告知を強化することで来店を促したいです。」
          </p>
          <p className="text-xs text-slate-600">
            （ポイント：構造化 → 仮説 → 施策 → 優先順位、の流れが見えていればOK）
          </p>
        </div>
      </section>

      {/* mentor.aiの使い方 */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">mentor.ai でのケース練習の流れ</h2>
        <ol className="space-y-2 text-sm text-slate-700 list-decimal list-inside">
          <li>お題となるケースを読む（状況を把握）</li>
          <li>「何が課題か」「売上か？利益か？」を一言で整理する</li>
          <li>売上などを分解して、どこが問題そうか仮説を置く</li>
          <li>仮説に対応する施策をいくつか出す</li>
          <li>「まずこれからやる」という一手を選ぶ</li>
          <li>AIからのフィードバックを見て、抜けや甘さを修正する</li>
        </ol>
      </section>

      <div className="pt-2">
        <button
          className="inline-flex items-center rounded-lg border border-violet-500 px-4 py-2 text-sm font-medium text-violet-700 hover:bg-violet-50"
        >
          ▶︎ ケース問題で実際に試してみる
        </button>
      </div>
    </div>
  );
};
