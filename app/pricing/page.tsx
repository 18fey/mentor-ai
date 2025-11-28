// app/pricing/page.tsx
export default function PricingPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="mb-4 text-2xl font-semibold">Mentor.AI プラン・料金</h1>
      <p className="mb-8 text-sm text-slate-600 leading-relaxed">
        Mentor.AI は、ケース面接・フェルミ推定・一般面接・ES添削を
        ワンストップでトレーニングできる就活・キャリア支援プラットフォームです。
        現在ご利用いただけるプランは次のとおりです。
      </p>

      <div className="grid gap-6 md:grid-cols-2">
        {/* FREEプラン */}
        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="mb-1 text-lg font-semibold">FREE（βテスト版）</h2>
          <p className="mb-4 text-sm text-slate-500">ベータテスト期間中に利用できる無料プランです。</p>
          <p className="mb-4 text-2xl font-semibold">¥0<span className="text-sm font-normal text-slate-500"> / 月</span></p>
          <ul className="mb-4 space-y-1 text-sm text-slate-600">
            <li>・ケース面接AI：月 3 回まで</li>
            <li>・フェルミ推定AI：月 3 問まで</li>
            <li>・一般面接AI（音声版）：月 1 セッションまで</li>
            <li>・ES添削AI：月 3 本まで</li>
            <li>・スコアダッシュボード：直近データのみ閲覧可能</li>
          </ul>
          <p className="text-xs text-slate-500">
            PROプランの正式提供開始前に、仕様や上限回数が変更される場合があります。
          </p>
        </section>

        {/* PROプラン */}
        <section className="rounded-2xl border bg-sky-50/70 p-6 shadow-sm ring-1 ring-sky-100">
          <h2 className="mb-1 text-lg font-semibold">PROプラン</h2>
          <p className="mb-4 text-sm text-slate-600">
            就活・転職対策を本格的に行いたい方向けの、有料サブスクリプションプランです。
          </p>
          <p className="mb-4 text-2xl font-semibold">
            ¥2,980<span className="text-sm font-normal text-slate-500"> / 月（税込）</span>
          </p>
          <ul className="mb-4 space-y-1 text-sm text-slate-700">
            <li>・ケース面接AI：回数無制限</li>
            <li>・フェルミ推定AI：回数無制限</li>
            <li>・一般面接AI（音声版）：回数無制限</li>
            <li>・ES添削AI：回数無制限</li>
            <li>・スコアダッシュボード：全期間の履歴保存・可視化</li>
            <li>・優先サポート：48時間以内の返信を目安としたメール／チャットサポート</li>
          </ul>
          <p className="mb-2 text-xs text-slate-600">
            お支払い方法：クレジットカード決済（決済代行サービス「PAY.JP」を利用）
          </p>
          <p className="text-xs text-slate-500">
            解約はいつでも可能です。解約手続き完了後は、次回以降の請求は発生しません。
            既にお支払いいただいた期間分の料金の返金は承っておりません。
          </p>
        </section>
      </div>

      <section className="mt-10 space-y-2 text-xs text-slate-500 leading-relaxed">
        <h2 className="text-sm font-semibold text-slate-700">その他のご案内</h2>
        <p>
          ・本サービスの内容や料金は、予告なく変更される場合があります。変更時には本サイト上でお知らせします。
        </p>
        <p>
          ・学生向けのキャンペーンや法人向けプラン等を提供する場合は、別途ページにてご案内いたします。
        </p>
      </section>
    </main>
  );
}
