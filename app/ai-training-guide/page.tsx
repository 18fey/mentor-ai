// app/ai-training/guide/page.tsx
export default function AiTrainingGuidePage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-14">
      <h1 className="text-3xl font-semibold text-slate-900">
        AI思考力トレーニングガイド（はじめての人向け）
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        AI思考力トレーニングは“正解当て”ではなく、AI協働の行動（目的・制約・収束・安全性）を測る30分トレーニングです。
        「何を書けばいいか分からない」をなくします。
      </p>

      {/* 30秒でわかる */}
      <section className="mt-8 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-slate-900">🟦 30秒でわかるAI思考力トレーニング</p>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700">
          <li>提出するのは「①プロンプト ②対話ログ ③最終成果物（200〜300字）」の3点セット</li>
          <li>評価は「目的/制約/構造化/検証/改善/成果物品質」＋補正（Compliance/Efficiency）</li>
          <li>目安は30分。2往復で収束できると実務耐性が高い</li>
        </ul>
      </section>

      {/* 図で見るフロー */}
      <section className="mt-8 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-slate-900">🧭 図で見る思考フロー</p>

        <div className="mt-4 rounded-xl bg-slate-50 p-5">
          <ol className="space-y-2 text-sm text-slate-700">
            <li>1. シナリオを読む（役割/制約/ゴール）</li>
            <li>2. 最初のプロンプトで「目的・制約・出力形式」を固定</li>
            <li>3. 1回目の出力に対して“不足3点”を短く指摘</li>
            <li>4. 2回目で“差分修正”して収束（同じテンプレで）</li>
            <li>5. 最終成果物に「前提/注意/チェック」を1文足して安全にする</li>
            <li>6. コピペで採点 → 次アクションで反復</li>
          </ol>
        </div>
      </section>

      {/* よくある失点 */}
      <section className="mt-8 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-slate-900">⚠️ よくある失点パターン</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {[
            ["目的が曖昧", "AIが迷って出力が散る。最初に“成果物の定義”を固定する。"],
            ["制約を書かない", "漏洩/断定/助言の事故リスク。NG/前提を1行で入れる。"],
            ["テンプレがない", "収束しない。出力フォーマットを最初に指定する。"],
            ["修正が長文", "どこ直すか不明。差分で3点だけ直す。"],
          ].map(([t, d]) => (
            <div key={t} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-800">{t}</p>
              <p className="mt-1 text-sm text-slate-600">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* スコアの見方 */}
      <section className="mt-8 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-slate-900">📊 スコアの見方</p>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700">
          <li>6軸：目的設定（Goal）制約設定（Constraint）構造化（Structuring）検証・評価（Evaluation）改善・収束（Refinement）成果物品質（Output）
</li>
          <li>補正：コンプライアンス（安全性）A/B/C、効率性（収束）A/B/C</li>
          <li>例：ACS 7.8 / Compliance A / Efficiency B</li>
        </ul>
      </section>

      {/* 高得点テンプレ */}
      <section className="mt-8 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-slate-900">🧩 高得点の“型”（テンプレ）</p>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs font-semibold text-slate-700">最初のプロンプト</p>
            <pre className="mt-2 whitespace-pre-wrap text-[12px] text-slate-700">
{`あなたは〇〇の専門家です。
目的：〜（成功条件まで）
制約：〜（禁止/前提/範囲）
出力：以下テンプレで。断定は避け、前提/注意点も入れる。
テンプレ：
施策名：
AIに任せる：
人が判断する：
安全・実行可能な理由：`}
            </pre>
          </div>

          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs font-semibold text-slate-700">差分修正（2往復目）</p>
            <pre className="mt-2 whitespace-pre-wrap text-[12px] text-slate-700">
{`不足は3点：
①〜が弱い ②〜が曖昧 ③〜が抜けてる
ルール：骨子は維持。追加・修正だけ。
同じテンプレで再出力して。`}
            </pre>
          </div>
        </div>
      </section>

      {/* 例題 */}
      <section className="mt-8 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-slate-900">🧠 例題：コンサル（導入/PoC設計）</p>
        <p className="mt-2 text-sm text-slate-600">
          “社内データは外部に出せない / IT専任なし / 3ヶ月で効果” という制約下で、会議で使える「最初の一手」を作ります。
        </p>

        <div className="mt-4 space-y-3">
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-xs font-semibold text-slate-700">Step1：プロンプト例</p>
            <pre className="mt-2 whitespace-pre-wrap text-[12px] text-slate-700">
{`目的：来週の社内会議でそのまま使える「AI導入の最初の一手」を1つ作る
制約：社内データは外部に出さない／IT専任なし／3ヶ月で効果が見えること
注意：断定を避け、前提・注意点を1文入れる
出力：200〜300字。施策名/AIに任せる/人が判断/安全・実行可能な理由 を必ず含める`}
            </pre>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-xs font-semibold text-slate-700">Step3：まとめ回答イメージ（200〜300字）</p>
            <div className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-slate-700">
              施策名：社内文書の“要約→FAQ化”パイロット（機密外から）／AIに任せる：公開済み規程・マニュアルを要約し、よくある質問のドラフト作成／人が判断する：対象文書の選定、最終文面、社内公開可否／安全・実行可能な理由：機密を含む文書は対象外にし、出力は人がレビューしてから共有する。IT専任不要で、問い合わせ削減など3ヶ月で効果検証しやすい。
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
