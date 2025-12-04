export default function FermiGuidePage() {
  return (
    <div className="max-w-4xl space-y-8">
      <h1 className="text-2xl font-semibold mb-2">フェルミ推定とは？（はじめての人向けガイド）</h1>
      <p className="text-sm text-slate-600">
        「センス」ではなく「型」で解けるようにするための、超実践ガイドです。
        出題パターンごとに解き方と例題をまとめています。
      </p>

      {/* 30秒サマリー */}
      <section className="bg-sky-50 border border-sky-100 rounded-2xl p-4 space-y-2">
        <h2 className="text-sm font-semibold text-sky-700">🏁 30秒でわかるフェルミ</h2>
        <p className="text-sm text-slate-700">
          フェルミ推定は、
          <strong>
            「分ける」→「数字を置く」→「計算」→「コメント」
          </strong>
          の4ステップだけ覚えればOK。<br />
          正解を当てるゲームではなく、「どう考えたか」を見せるトレーニングです。
        </p>
      </section>

      {/* 図で見るフロー */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">🧭 図で見る思考フロー</h2>
        <pre className="bg-white/80 border border-slate-100 rounded-2xl p-4 text-xs leading-6 text-slate-700 whitespace-pre-wrap">
{`問題
  ↓
どう分ける？（式の形を決める）
  ↓
ざっくり数字を置く
  ↓
計算する
  ↓
「多そう/少なそう」などコメントする`}
        </pre>
        <p className="text-xs text-slate-500">
          どんな問題でも、まず「何 × 何 で表せるか？」を決めるところから始めます。
        </p>
      </section>

      {/* 出題パターン一覧 */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">📚 出題パターンと解き方の型</h2>

        <div className="space-y-4 text-sm text-slate-700">
          <div className="bg-white/80 border border-slate-100 rounded-2xl p-4 space-y-1">
            <p className="text-xs font-semibold text-slate-500">パターン①</p>
            <p className="font-semibold">数・台数系（自販機・タクシー・店舗数など）</p>
            <p>👉 「エリアごとにいくつあるか」で考える。</p>
            <p className="text-xs text-slate-500">
              式イメージ：<strong>エリア数 × 1エリアあたりの台数</strong>
            </p>
          </div>

          <div className="bg-white/80 border border-slate-100 rounded-2xl p-4 space-y-1">
            <p className="text-xs font-semibold text-slate-500">パターン②</p>
            <p className="font-semibold">人数・利用者数系（ユーザー数・利用者数など）</p>
            <p>👉 「母集団 × 利用率」で考える。</p>
            <p className="text-xs text-slate-500">
              式イメージ：<strong>人口（母集団） × 使っていそうな割合</strong>
            </p>
          </div>

          <div className="bg-white/80 border border-slate-100 rounded-2xl p-4 space-y-1">
            <p className="text-xs font-semibold text-slate-500">パターン③</p>
            <p className="font-semibold">市場規模・売上系（○○市場はいくらか？）</p>
            <p>👉 「人数 × 単価 × 頻度」で考える。</p>
            <p className="text-xs text-slate-500">
              式イメージ：
              <strong>ユーザー数 × 1回あたりの支出 × 年間利用回数</strong>
            </p>
          </div>

          <div className="bg-white/80 border border-slate-100 rounded-2xl p-4 space-y-1">
            <p className="text-xs font-semibold text-slate-500">パターン④</p>
            <p className="font-semibold">時間・頻度系（〜が1日に何回起こるか？）</p>
            <p>👉 「1人あたりの頻度 × 人数」で考える。</p>
            <p className="text-xs text-slate-500">
              式イメージ：
              <strong>1人あたりの回数 × 人数 → 日 → 年へ換算</strong>
            </p>
          </div>
        </div>
      </section>

      {/* 例題1：自販機（台数系）実況 */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">🧠 例題①：自動販売機の数（台数系）</h2>
        <p className="text-sm text-slate-700">
          <strong>Q. 日本にある自動販売機は何台くらい？</strong>
        </p>

        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-2 text-sm text-slate-700">
          <p className="font-semibold text-slate-800">実況イメージ</p>
          <p>①「これはパターン①（台数系）だから、エリアで考えよう。」</p>
          <p>②「日本の市区町村って、だいたい1,700くらいだったはず。」</p>
          <p>③「1つの市区町村に、自販機が平均200台くらいありそう。」</p>
          <p>④「1,700 × 200 = 340,000台、約34万台。」</p>
          <p>⑤
            「都市部はもっと多いし、地方は少ないから、
            <strong>全体では40〜60万台くらい</strong>とコメントしておこう。」
          </p>
        </div>

        <p className="text-xs text-slate-500">
          ✅ 大事なのは、「どのパターンで、どんな式にしたか」が説明できていることです。
        </p>
      </section>

      {/* 例題2：コーヒー市場（市場規模系） */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">📈 例題②：コーヒー市場規模（市場規模系）</h2>
        <p className="text-sm text-slate-700">
          <strong>Q. 日本のコンビニコーヒー市場は年間いくらくらい？</strong>
        </p>

        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-2 text-sm text-slate-700">
          <p className="font-semibold text-slate-800">解き方の型（パターン③）</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>ユーザー数を見積もる（飲みそうな人の人数）</li>
            <li>1杯あたりの単価を置く</li>
            <li>1人あたりの年間利用回数を置く</li>
            <li>掛け算して年間市場を出す</li>
          </ol>
        </div>

        <div className="bg-white/80 border border-emerald-100 rounded-2xl p-4 space-y-1 text-sm text-slate-800">
          <p className="font-semibold">ざっくり計算例</p>
          <p>・飲みそうな人：3,000万人</p>
          <p>・1杯 150円</p>
          <p>・1人あたり年間100杯飲むと仮定</p>
          <p>→ 3,000万人 × 150円 × 100杯 = 4.5兆円</p>
          <p className="text-xs text-slate-600">
            「実際はもう少し小さいかもしれないので、2〜4兆円規模」とコメントする、など。
          </p>
        </div>
      </section>

      {/* mentor.ai の使い方 */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">🧪 mentor.ai での練習の仕方</h2>
        <ol className="list-decimal list-inside text-sm text-slate-700 space-y-1">
          <li>問題文を読んで「どのパターンか」をまず決める</li>
          <li>自分で式（分け方）を書いてみる</li>
          <li>数字を置いて計算する</li>
          <li>最後にコメントをつける</li>
          <li>AIの模範解答・フィードバックと比較して修正する</li>
        </ol>
      </section>
    </div>
  );
}
