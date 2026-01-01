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
          <dd>渡邉 花鈴</dd>
        </div>

        <div>
          <dt className="font-semibold">所在地</dt>
          <dd className="whitespace-pre-line">
            〒104-0061{"\n"}
            東京都中央区銀座一丁目22番11号{"\n"}
            銀座大竹ビジデンス 2F{"\n"}
            ※郵便物は必ず「2F」までご記入ください。
          </dd>
        </div>

        <div>
          <dt className="font-semibold">お問い合わせ先</dt>
          <dd className="whitespace-pre-line">
            メール：support@mentor-ai.net{"\n"}
            お問い合わせフォーム：準備中
          </dd>
        </div>

        <div>
          <dt className="font-semibold">販売URL</dt>
          <dd>https://www.mentor-ai.net</dd>
        </div>

        <div>
          <dt className="font-semibold">販売価格</dt>
          <dd>月額 2,980円（税込）／その他プランは料金ページに表示</dd>
        </div>

        <div>
          <dt className="font-semibold">商品代金以外の必要料金</dt>
          <dd>インターネット接続にかかる通信費（ユーザー負担）</dd>
        </div>

        <div>
          <dt className="font-semibold">支払方法</dt>
          <dd>クレジットカード決済（PAY.JP）</dd>
        </div>

        <div>
          <dt className="font-semibold">支払時期</dt>
          <dd>
            申込時に決済。以降は自動更新（ユーザーが解約しない限り継続）。
          </dd>
        </div>

        <div>
          <dt className="font-semibold">サービス提供時期</dt>
          <dd>決済完了後ただちに利用可能。</dd>
        </div>

        <div>
          <dt className="font-semibold">返品・キャンセル</dt>
          <dd>
            デジタルサービスの特性上、決済後の返金には対応しておりません（法令に基づく例外を除く）。
            解約はいつでも可能ですが、日割りや返金はありません。
          </dd>
        </div>

        <div>
          <dt className="font-semibold">動作環境</dt>
          <dd>
            PCまたはスマートフォンのブラウザ（Chrome 推奨）。
            詳細は利用ガイドにて案内予定。
          </dd>
        </div>

      </dl>
    </main>
  );
}
