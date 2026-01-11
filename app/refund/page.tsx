// app/refund/page.tsx
export default function RefundPolicyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-2 text-2xl font-semibold">返金ポリシー（Metaコイン）</h1>
      <p className="mb-6 text-xs text-slate-500">
        制定日：2025年12月10日
      </p>

      <div className="space-y-6 text-sm leading-relaxed text-slate-700">
        <p>
          Mentor.AI の運営者である渡邉花鈴（事業所：東京都中央区銀座一丁目22番11号
          銀座大竹ビジデンス 2F。以下「当社」といいます）は、当社が提供するデジタルクレジット「Metaコイン」の購入および返金に関する条件を、以下のとおり定めます。
          なお、本ポリシーの内容は「Mentor.AI 利用規約」（以下「当社規約」といいます）の一部を構成し、
          本ポリシーの用語の定義は、本ポリシーに別段の定めがあるものを除き、当社規約に定めるところによるものとします。
        </p>

        {/* 第1条 */}
        <section>
          <h2 className="mb-2 text-base font-semibold">第1条（本コインの性質）</h2>
          <ol className="list-inside list-decimal space-y-2">
            <li>
              Metaコインは、当社が提供する一部機能（高度AI解析、深い面接フィードバック、詳細レポート生成その他当社所定の有料機能）の利用権として付与されるデジタルコンテンツであり、通貨ではありません。
            </li>
            <li>
              Metaコインは、法律上の「前払式支払手段」「資金移動業」に関する規定が適用されないよう設計されています。
            </li>
            <li>
              Metaコインは、本サービス内でのみ利用できるものとし、第三者への譲渡、販売、交換、貸与、担保供与その他の処分はしてはならないものとします。
            </li>
          </ol>
        </section>

        {/* 第2条 */}
        <section>
          <h2 className="mb-2 text-base font-semibold">第2条（購入後の返金について）</h2>
          <ol className="list-inside list-decimal space-y-2">
            <li>Metaコインはデジタル商品の性質上、購入後の返金には一切対応しておりません。</li>
            <li>未使用のMetaコインについても、ユーザー都合による返金・換金・払い戻しは行いません。</li>
            <li>
              ただし、以下の場合は当社判断により返金または代替手段を提供することがあります。
              <ul className="mt-2 list-inside list-disc space-y-1">
                <li>（1）当社の決済処理上の過誤により二重決済が発生した場合</li>
                <li>（2）法令により返金対応が義務付けられる場合</li>
                <li>
                  （3）長期間にわたる重大なサービス障害により、Metaコインの利用が著しく困難と判断される場合
                </li>
              </ul>
            </li>
          </ol>
        </section>

        {/* 第3条 */}
        <section>
          <h2 className="mb-2 text-base font-semibold">第3条（Metaコインの有効期限）</h2>
          <ol className="list-inside list-decimal space-y-2">
            <li>Metaコインの有効期限は、購入日から180日間とします。</li>
            <li>有効期限を過ぎたMetaコインは自動的に失効し、返金・復元等はできません。</li>
          </ol>
        </section>

        {/* 第4条 */}
        <section>
          <h2 className="mb-2 text-base font-semibold">第4条（利用できない場合の取扱い）</h2>
          <p className="mb-2">
            以下の理由でMetaコインが利用できなかった場合または利用できなくなった場合でも、返金対象にはなりません。
          </p>
          <ol className="list-inside list-decimal space-y-2">
            <li>ユーザーの端末・通信環境・ブラウザ設定に起因する障害</li>
            <li>軽微なサーバー障害やメンテナンスによる一時的な不具合</li>
            <li>
              当社規約に基づき、ユーザーのアカウントの利用が停止されまたは利用契約が解除その他の理由により終了した場合
            </li>
            <li>Metaコインの利用の対象となる本サービスにおけるAI機能の改善・内容変更</li>
          </ol>
        </section>

        {/* 第5条 */}
        <section>
          <h2 className="mb-2 text-base font-semibold">第5条（サービス終了時の扱い）</h2>
          <ol className="list-inside list-decimal space-y-2">
            <li>
              当社が本サービスの全部または一部を終了する場合、未使用のMetaコインの払い戻し義務は負わないものとします。
            </li>
            <li>
              ただし、ユーザー保護の観点から、本サービスを終了する際のスケジュールに応じて代替措置を提供する場合があります。
            </li>
          </ol>
        </section>

        {/* 第6条 */}
        <section>
          <h2 className="mb-2 text-base font-semibold">第6条（変更）</h2>
          <p>
            当社は、必要に応じて本ポリシーを変更することがあります。本ポリシーの変更の方法および手続等については、当社規約の規定に従うものとします。
          </p>
        </section>

        {/* 第7条 */}
        <section>
          <h2 className="mb-2 text-base font-semibold">第7条（お問い合わせ）</h2>
          <p>返金ポリシーに関するお問い合わせは、以下の窓口までご連絡ください。</p>
          <p className="mt-2 whitespace-pre-line">
            Mentor.AI{"\n"}
            メール：support@mentor-ai.net
          </p>
        </section>

        <p className="text-right text-xs text-slate-500">
          制定日：2025年12月10日
        </p>

        <div className="pt-4 text-xs text-slate-500">
          関連ページ：{" "}
          <a href="/terms" className="underline hover:text-slate-800">
            利用規約
          </a>{" "}
          ｜{" "}
          <a href="/privacy" className="underline hover:text-slate-800">
            プライバシーポリシー
          </a>{" "}
          ｜{" "}
          <a href="/legal" className="underline hover:text-slate-800">
            特定商取引法に基づく表記
          </a>
        </div>
      </div>
    </main>
  );
}
