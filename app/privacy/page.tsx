// app/privacy/page.tsx
export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-semibold">プライバシーポリシー</h1>

      <div className="space-y-6 text-sm leading-relaxed text-slate-700">
        <p>
          Mentor.AI（以下「当社」といいます）は、当社が提供する「Mentor.AI」
          （以下「本サービス」といいます）において取り扱うユーザーの個人情報等について、
          以下のとおりプライバシーポリシー（以下「本ポリシー」といいます）を定めます。
        </p>

        <section>
          <h2 className="mb-2 text-base font-semibold">第1条（適用範囲）</h2>
          <p>
            本ポリシーは、本サービスにおいて当社が取得するユーザー情報の取り扱いに適用されます。
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold">第2条（取得する情報の種類）</h2>
          <p>当社は、本サービスの提供にあたり、主に次の情報を取得することがあります。</p>
          <ul className="mt-1 list-inside list-disc">
            <li>氏名またはニックネーム、大学名、学部、学年 等</li>
            <li>志望業界・志望企業・興味関心タグ 等</li>
            <li>ログイン日時、利用した機能、スコア等の利用履歴</li>
            <li>IPアドレス、ブラウザ情報、Cookie 情報などの技術情報</li>
            <li>お問い合わせ時にユーザーが任意で提供する情報</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold">第3条（利用目的）</h2>
          <p>当社は、取得した情報を以下の目的で利用します。</p>
          <ul className="mt-1 list-inside list-disc">
            <li>本サービスの提供および運営のため</li>
            <li>本サービスの改善、新機能の開発のため</li>
            <li>利用状況の分析、統計データの作成のため</li>
            <li>本サービスに関する案内・お問い合わせへの対応のため</li>
            <li>不正行為の防止、セキュリティ確保のため</li>
            <li>法令または行政機関等から要請された場合にこれに対応するため</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold">第4条（第三者提供）</h2>
          <p>当社は、次の場合を除き、ユーザーの個人情報を第三者に提供しません。</p>
          <ul className="mt-1 list-inside list-disc">
            <li>ユーザー本人の同意がある場合</li>
            <li>法令に基づく場合</li>
            <li>人の生命・身体・財産の保護のために必要であり、同意取得が困難な場合</li>
            <li>事業承継に伴って個人情報が提供される場合</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold">第5条（業務委託）</h2>
          <p>
            当社は、本サービスの運営に必要な範囲で、個人情報の取り扱いの一部を外部事業者に委託することがあります。
            この場合、当社は、委託先に対し、適切な管理・監督を行います。
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold">第6条（安全管理措置）</h2>
          <p>
            当社は、個人情報の漏えい、滅失またはき損の防止その他個人情報の安全管理のために、必要かつ適切な措置を講じます。
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold">第7条（Cookie等の利用）</h2>
          <p>
            本サービスでは、ユーザーの利便性向上やアクセス解析のために Cookie や類似の技術を利用することがあります。
            ユーザーはブラウザの設定により Cookie の利用を制限できますが、その場合、本サービスの一部機能が利用できなくなることがあります。
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold">
            第8条（保有個人データの開示・訂正・利用停止等）
          </h2>
          <p>
            ユーザーは、当社が保有する自己の個人情報について、開示・訂正・追加・削除・利用停止等を求めることができます。
            これらの請求を行う場合は、下記お問い合わせ窓口までご連絡ください。
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold">第9条（プライバシーポリシーの変更）</h2>
          <p>
            当社は、必要に応じて本ポリシーを変更することがあります。
            重要な変更を行う場合は、本サービス上での掲示その他当社が適当と判断する方法により周知します。
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold">第10条（お問い合わせ窓口）</h2>
          <p>本ポリシーに関するお問い合わせは、以下の窓口までご連絡ください。</p>
          <p className="mt-2 whitespace-pre-line">
            Mentor.AI{"\n"}
            〒104-0061{"\n"}
            東京都中央区銀座一丁目22番11号{"\n"}
            銀座大竹ビジデンス 2F{"\n"}
            ※郵便物（住所）は必ず2Fまでご記入ください。{"\n"}
            メールアドレス：support@mentor-ai.net
          </p>
        </section>

        <p className="text-right text-xs text-slate-500">
          制定日：2025年11月25日
        </p>

        {/* ▼ 相互リンク（ここを追加） */}
        <div className="pt-4 text-xs text-slate-500">
          関連ページ：{" "}
          <a href="/terms" className="underline hover:text-slate-800">
            利用規約
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
