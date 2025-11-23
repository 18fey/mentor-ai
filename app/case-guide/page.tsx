export default function CaseGuidePage() {
  return (
    <div className="max-w-4xl space-y-8">
      <h1 className="text-2xl font-semibold mb-2">ケース面接ガイド（本番版）</h1>
      <p className="text-sm text-slate-600">
        ケース面接でよく出るパターンと、その考え方の型をまとめたガイドです。
        「何から話せばいいか分からない」をなくします。
      </p>

      {/* 30秒サマリー */}
      <section className="bg-violet-50 border border-violet-100 rounded-2xl p-4 space-y-2">
        <h2 className="text-sm font-semibold text-violet-700">🏁 30秒でわかるケース</h2>
        <p className="text-sm text-slate-700">
          ケースは、
          <strong>
            課題整理 → 分解 → 仮説 → 対策 → 優先順位
          </strong>
          の順番で考える練習です。<br />
          「アイデア出しまくり面接」ではなく、
          「構造的に話す力」を見られています。
        </p>
      </section>

      {/* 図で見るフロー */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">🧭 図で見る思考フロー</h2>
        <pre className="bg-white/80 border border-slate-100 rounded-2xl p-4 text-xs leading-6 text-slate-700 whitespace-pre-wrap">
{`お題を読む
  ↓
「何が課題か？」を一言で言う
  ↓
売上などを式で分解（客数×単価 など）
  ↓
どこが問題そうか仮説を置く
  ↓
仮説に対応した打ち手を考える
  ↓
効果 × 実現性で優先順位をつける`}
        </pre>
      </section>

      {/* 出題パターン */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">📚 よくある出題パターンと型</h2>
        <div className="space-y-4 text-sm text-slate-700">
          <div className="bg-white/80 border border-slate-100 rounded-2xl p-4 space-y-1">
            <p className="text-xs font-semibold text-slate-500">パターン①</p>
            <p className="font-semibold">売上を増やす系</p>
            <p>👉 「売上 = 客数 × 客単価」で分解するのが基本。</p>
          </div>
          <div className="bg-white/80 border border-slate-100 rounded-2xl p-4 space-y-1">
            <p className="text-xs font-semibold text-slate-500">パターン②</p>
            <p className="font-semibold">コスト削減系</p>
            <p>👉 固定費 / 変動費 / プロセスで分解して考える。</p>
          </div>
          <div className="bg-white/80 border border-slate-100 rounded-2xl p-4 space-y-1">
            <p className="text-xs font-semibold text-slate-500">パターン③</p>
            <p className="font-semibold">新規事業・参入系</p>
            <p>👉 市場 / 競合 / 自社の強み / 収益性 で整理する。</p>
          </div>
          <div className="bg-white/80 border border-slate-100 rounded-2xl p-4 space-y-1">
            <p className="text-xs font-semibold text-slate-500">パターン④</p>
            <p className="font-semibold">原因分析系（売上が落ちた理由など）</p>
            <p>👉 売上分解 → どの要素が変化したか仮説を置いて検証する。</p>
          </div>
        </div>
      </section>

      {/* 例題1：ファミレス（売上アップ系）実況 */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">🧠 例題①：ファミレスの売上改善（売上系）</h2>
        <p className="text-sm text-slate-700">
          <strong>Q. 郊外にあるファミレスの売上がここ3ヶ月で20％落ちています。どう改善しますか？</strong>
        </p>

        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-2 text-sm text-slate-700">
          <p className="font-semibold text-slate-800">実況イメージ</p>
          <p>①「これは売上系だから、まず売上 = 客数 × 客単価で考えよう。」</p>
          <p>②「お題には“平日夜がガラガラ”とあるので、客数が問題と仮説を置く。」</p>
          <p>③「特に学生・若者が来なくなっているのでは？」</p>
          <p>④「理由は、学割がない / 夜に来る理由が弱い、あたりが怪しい。」</p>
          <p>⑤「だから、平日夜限定の学生セット＋SNS告知をまず提案しよう。」</p>
        </div>

        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 text-sm text-slate-800">
          <p className="font-semibold">✅ まとめ回答イメージ</p>
          <p>
            「売上減少の原因は、平日夜の学生・若者の来店が減っている点にあると考えました。
            そのため、平日夜限定の学生向けセットを導入し、SNSでの告知を強化することで来店数の回復を狙います。」
          </p>
          <p className="text-xs text-slate-600 mt-1">
            構造（売上分解）→ 仮説 → 施策 → 優先順位、の流れが見えていればOK。
          </p>
        </div>
      </section>

      {/* 例題2：コスト削減系 */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">💸 例題②：工場のコスト削減（コスト系）</h2>
        <p className="text-sm text-slate-700">
          <strong>Q. ある飲料工場のコストを削減したい。どこから見ますか？</strong>
        </p>

        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-2 text-sm text-slate-700">
          <p className="font-semibold text-slate-800">解き方の型（パターン②）</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>コストを固定費 / 変動費に分ける</li>
            <li>変動費：原材料費 / 人件費 / エネルギー / 物流 などに分解</li>
            <li>どこが一番大きいか・増えているかを仮説で置く</li>
            <li>その要素に対する具体的な施策を考える</li>
          </ol>
        </div>

        <div className="bg-white/80 border border-emerald-100 rounded-2xl p-4 text-sm text-slate-800 space-y-1">
          <p className="font-semibold">ざっくり回答イメージ</p>
          <p>
            「まずコスト構造を固定費と変動費に分け、変動費の中で割合が大きい原材料費とエネルギー費用に注目します。
            原材料の調達条件の見直しや、生産ラインの省エネ化・稼働率向上などを検討します。」
          </p>
        </div>
      </section>

      {/* mentor.ai の使い方 */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">🧪 mentor.ai でのケース練習の仕方</h2>
        <ol className="list-decimal list-inside text-sm text-slate-700 space-y-1">
          <li>お題を読んで「売上系？コスト系？新規事業系？」をまず判定する</li>
          <li>「何が課題か」を一言で整理する</li>
          <li>式（売上やコスト）に分解して、どこが問題そうか仮説を置く</li>
          <li>仮説に対応した打ち手を考える</li>
          <li>「まずやる一手」を選び、優先順位の理由も話す</li>
          <li>AIの深掘り質問・フィードバックを見て、抜けを埋める</li>
        </ol>
      </section>
    </div>
  );
}
