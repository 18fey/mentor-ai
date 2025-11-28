// app/service/page.tsx
export default function ServicePage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <h1 className="mb-6 text-3xl font-semibold text-slate-900">
        Mentor.AI サービス概要
      </h1>

      <p className="mb-8 text-sm leading-relaxed text-slate-700">
        Mentor.AIは、AI技術を活用したキャリア支援・就職活動サポートプラットフォームです。
        就職活動における「自己分析」「面接対策」「思考力強化」「ES添削」を統合的に支援し、
        個々の能力を最大限に引き出すことを目的としています。
      </p>

      <section className="mb-10">
        <h2 className="mb-4 text-xl font-semibold">提供機能</h2>
        <ul className="grid gap-3 text-sm text-slate-700 md:grid-cols-2">
          <li>AIによる面接練習およびフィードバック</li>
          <li>思考構造トレーニング（ロジカル・ケース・フェルミ対応）</li>
          <li>エントリーシート自動添削・改善提案</li>
          <li>キャリア適性診断</li>
          <li>学習進捗ダッシュボード</li>
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="mb-4 text-xl font-semibold">対象ユーザー</h2>
        <ul className="list-disc pl-5 text-sm text-slate-700">
          <li>大学生・大学院生</li>
          <li>就職活動準備中の学生</li>
          <li>キャリア形成を見直したい若手社会人</li>
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="mb-4 text-xl font-semibold">運営情報</h2>
        <div className="text-sm text-slate-700 space-y-1">
          <p>サービス名：Mentor.AI</p>
          <p>運営者：Mentor.AI（個人事業）</p>
          <p>代表者：渡邉 花鈴</p>
          <p>所在地：東京都（バーチャルオフィス利用）</p>
          <p>お問い合わせ：support@mentor-ai.net</p>
        </div>
      </section>
    </main>
  );
}
