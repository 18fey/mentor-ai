// app/legal/page.tsx
export default function LegalPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-semibold">特定商取引法に基づく表記</h1>

      <dl className="space-y-4 text-sm leading-relaxed text-slate-700">
        <div>
          <dt className="font-semibold">役務提供事業者名、住所および電話番号</dt>
          <dd>下記お問い合わせ先に請求があった場合には、遅滞なく提供します。</dd>
        </div>

        <div>
          <dt className="font-semibold">お問い合わせ先</dt>
          <dd className="whitespace-pre-line">
            メール：support@mentor-ai.net{"\n"}
            お問い合わせフォーム：準備中（開設次第、本ページにURLを表示します）
          </dd>
        </div>

        <div>
          <dt className="font-semibold">販売URL</dt>
          <dd>https://mentor-ai.net/</dd>
        </div>

        <div>
          <dt className="font-semibold">販売価格</dt>
          <dd className="whitespace-pre-line">
            ・本サービス内で案内するデジタルコイン「Meta」（以下「Metaコイン」といいます）の価格は、各購入画面に表示する金額（税込）とします。{"\n"}
            ・将来、月額プラン等のサブスクリプションを提供する場合は、別途料金ページにて表示します。
          </dd>
        </div>

        <div>
          <dt className="font-semibold">商品代金以外の必要料金</dt>
          <dd className="whitespace-pre-line">
            ・インターネット接続に係る通信料（金額はユーザーが契約した各事業者が定める通り）
          </dd>
        </div>

        <div>
          <dt className="font-semibold">支払方法</dt>
          <dd className="whitespace-pre-line">
            ・クレジットカード決済（ストライプジャパン株式会社の提供する決済代行サービス「Stripe」を利用します）
          </dd>
        </div>

        <div>
          <dt className="font-semibold">支払時期</dt>
          <dd className="whitespace-pre-line">
            ・Metaコイン：購入手続き時に決済（実際のユーザーの銀行口座からの引き落とし日は、ご利用のクレジットカード会社までお問い合わせください）{"\n"}
            ・サブスクリプションプランを提供する場合：当該サブスクリプションプランへの申込時に初回決済。その後は当該サブスクリプションプランをご解約いただかない限り、各プランの定める周期で自動的に決済されます（詳細は料金ページおよび利用規約に定めます）（実際のユーザーの銀行口座からの引き落とし日は、ご利用のクレジットカード会社までお問い合わせください）。
          </dd>
        </div>

        <div>
          <dt className="font-semibold">商品の引渡し時期・サービス提供時期</dt>
          <dd className="whitespace-pre-line">
            ・決済完了後、ただちに本サービス上でMetaコインが付与され、Metaコインを消費して利用することのできる機能の利用が可能になります（通信状況により数分程度の遅延が生じることがあります）。
          </dd>
        </div>

        <div>
          <dt className="font-semibold">返品・キャンセル・解約</dt>
          <dd className="whitespace-pre-line">
            ・本サービスはデジタルコンテンツおよびオンラインサービスであるため、Metaコインの購入手続き完了後のキャンセル・返金には原則として対応しておりません（法令により返金が義務付けられる場合を除きます）。{"\n"}
            ・サブスクリプションプランを利用する場合、ユーザーは当社所定の方法によりいつでも解約手続きを行うことができますが、解約手続き後も既に支払われた利用料金について日割り計算等による返金は行われません。
            {"\n"}
            {"\n"}
            ※Metaコインの返金条件・有効期限等の詳細は{" "}
            <a href="/refund" className="underline hover:text-slate-800">
              返金ポリシー（Metaコイン）
            </a>{" "}
            をご確認ください。
          </dd>
        </div>

        <div>
          <dt className="font-semibold">動作環境</dt>
          <dd className="whitespace-pre-line">
            ・PCまたはスマートフォンのブラウザからの利用を想定しています。{"\n"}
            ・推奨環境（OS、ブラウザ等）の詳細は、次の通りとなります。
          </dd>
        </div>
      </dl>

      <div className="pt-6 text-xs text-slate-500">
        関連ページ：{" "}
        <a href="/terms" className="underline hover:text-slate-800">
          利用規約
        </a>{" "}
        ｜{" "}
        <a href="/privacy" className="underline hover:text-slate-800">
          プライバシーポリシー
        </a>{" "}
        ｜{" "}
        <a href="/refund" className="underline hover:text-slate-800">
          返金ポリシー（Metaコイン）
        </a>
      </div>
    </main>
  );
}
