// app/legal/page.tsx
export default function LegalPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-semibold">
        特定商取引法に基づく表記
      </h1>

      <dl className="space-y-4 text-sm leading-relaxed text-slate-700">
        <div>
          <dt className="font-semibold">販売事業者名</dt>
          <dd>渡邉 花鈴（屋号：Mentor.AI）</dd>
        </div>

        <div>
          <dt className="font-semibold">運営責任者</dt>
          <dd>
           渡邉　花鈴
          </dd>
        </div>

        <div>
          <dt className="font-semibold">所在地</dt>
          <dd className="whitespace-pre-line">
            〒104-0061{"\n"}
            東京都中央区銀座一丁目22番11号{"\n"}
            銀座大竹ビジデンス 2F{"\n"}
            ※郵便物（住所）は必ず2Fまでご記入ください。
          </dd>
        </div>

        <div>
          <dt className="font-semibold">お問い合わせ先</dt>
          <dd className="whitespace-pre-line">
            メールアドレス：support@mentor-ai.net{"\n"}
            お問い合わせフォーム：準備中
          </dd>
        </div>

        <div>
          <dt className="font-semibold">販売URL</dt>
          <dd>https://mentor-ai-2rw9.vercel.app</dd>
        </div>

        <div>
          <dt className="font-semibold">販売価格</dt>
          <dd>各プランの料金ページに表示（消費税込）。</dd>
        </div>

        <div>
          <dt className="font-semibold">商品代金以外の必要料金</dt>
          <dd>インターネット接続にかかる通信費等（ユーザー負担）。</dd>
        </div>

        <div>
          <dt className="font-semibold">支払方法</dt>
          <dd>クレジットカード決済（決済代行サービス「PAY.JP」を利用）。</dd>
        </div>

        <div>
          <dt className="font-semibold">支払時期</dt>
          <dd>
            申込時に決済。以降は契約期間満了前に自動更新される場合があります（詳しくはプラン・料金ページをご確認ください）。
          </dd>
        </div>

        <div>
          <dt className="font-semibold">サービス提供時期</dt>
          <dd>決済完了後、ただちにご利用いただけます。</dd>
        </div>

        <div>
          <dt className="font-semibold">返品・キャンセル</dt>
          <dd>
            サービスの性質上、決済完了後の返品・返金はお受けしておりません。
            解約はいつでも可能ですが、解約月の利用料金の日割り計算や返金は行っておりません。
          </dd>
        </div>

        <div>
          <dt className="font-semibold">動作環境</dt>
          <dd>
            PCまたはスマートフォンのインターネットブラウザから利用可能です。
            推奨ブラウザ等は利用ガイドページにて別途案内します。
          </dd>
        </div>
      </dl>
    </main>
  );
}
