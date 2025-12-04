// app/privacy/page.tsx
export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-2 text-2xl font-semibold">プライバシーポリシー</h1>
      <p className="mb-6 text-xs text-slate-500">
        制定日：2025年11月25日　／　最終更新日：2025年12月2日
      </p>

      <div className="space-y-6 text-sm leading-relaxed text-slate-700">
        <p>
          Mentor.AI（以下「当社」といいます）は、当社が提供する AI 診断・面接支援サービス
          「Mentor.AI」（以下「本サービス」といいます）において取り扱うユーザー情報の保護を重要な責務と認識し、
          以下のとおりプライバシーポリシー（以下「本ポリシー」といいます）を定めます。
        </p>

        {/* 第1条 */}
        <section>
          <h2 className="mb-2 text-base font-semibold">第1条（適用範囲）</h2>
          <p>
            1.
            本ポリシーは、本サービスの利用を通じて当社が取得するユーザー情報の取扱い全般に適用されます。
          </p>
          <p>
            2.
            本ポリシーは、個人ユーザー、企業ユーザー、OEM パートナー、API 利用者その他本サービスを利用するすべての者に適用されます。
          </p>
          <p>
            3.
            企業契約・OEM 契約・API 契約において別途の定めがある場合、当該契約が本ポリシーに優先します。
          </p>
        </section>

        {/* 第2条 */}
        <section>
          <h2 className="mb-2 text-base font-semibold">第2条（取得する情報）</h2>
          <p>当社は、利用形態に応じて以下の情報を取得することがあります。</p>

          <h3 className="mt-2 text-sm font-semibold">（1）個人ユーザーから取得する情報</h3>
          <ul className="mt-1 list-inside list-disc">
            <li>氏名またはニックネーム</li>
            <li>メールアドレス</li>
            <li>大学名、学部、学年等のプロフィール情報</li>
            <li>志望業界・志望企業・興味関心タグ等</li>
            <li>診断への回答内容、面接 AI・ES 添削等への入力内容</li>
            <li>ログイン日時、利用した機能、スコア等の利用履歴</li>
            <li>IP アドレス、ブラウザ情報、端末情報、Cookie 情報等の技術情報</li>
            <li>お問い合わせ時にユーザーが任意で提供する情報</li>
          </ul>

          <h3 className="mt-4 text-sm font-semibold">（2）企業ユーザーから取得する情報</h3>
          <ul className="mt-1 list-inside list-disc">
            <li>企業名、部署名、担当者名、連絡先</li>
            <li>従業員 ID 等の識別子</li>
            <li>企業が当社に提供する従業員の属性情報（契約内容による）</li>
            <li>従業員の診断回答、スコア、利用履歴</li>
            <li>管理者アカウントの操作ログ</li>
          </ul>

          <h3 className="mt-4 text-sm font-semibold">（3）OEM パートナー／API 利用者から取得する情報</h3>
          <ul className="mt-1 list-inside list-disc">
            <li>API キーおよび関連付けられたアカウント情報</li>
            <li>API 経由の入力データ（テキスト、回答内容等）</li>
            <li>API 呼び出し回数、エラーログ等の技術的情報</li>
            <li>障害対応・サポートに必要な範囲での追加情報</li>
          </ul>
        </section>

        {/* 第3条 */}
        <section>
          <h2 className="mb-2 text-base font-semibold">第3条（利用目的）</h2>
          <p>当社は、取得した情報を以下の目的で利用します。</p>
          <ul className="mt-1 list-inside list-disc">
            <li>本サービスの提供、運営、維持、改善のため</li>
            <li>診断結果、レポート、フィードバック等を生成・表示するため</li>
            <li>外部 AI モデル（OpenAI API 等）を利用して回答・解析を行うため</li>
            <li>本サービスに関する案内、重要なお知らせを送信するため</li>
            <li>ユーザーからの問い合わせに対応するため</li>
            <li>利用状況の分析、統計データ・匿名加工情報の作成のため</li>
            <li>不正アクセスや不正利用の検知・防止等、セキュリティ確保のため</li>
            <li>法令または行政機関等から要請された場合にこれに対応するため</li>
          </ul>
        </section>

        {/* 第4条 */}
        <section>
          <h2 className="mb-2 text-base font-semibold">第4条（外部 AI モデルの利用について）</h2>
          <p>
            1.
            当社は、本サービスの機能提供のために OpenAI API（GPT-4.1 等）その他の外部 AI モデルを利用します。
          </p>
          <p>
            2.
            当社は、必要最小限の情報のみを外部 AI モデルに送信するよう配慮し、機密情報を含まない設計に努めます。
          </p>
          <p>
            3.
            OpenAI API を利用する場合、API 経由で送信されたデータは、OpenAI によりモデルの再学習には利用されません。
          </p>
          <p>
            4.
            外部 AI モデルの仕様変更・停止等により生じた影響について、当社は合理的な範囲を超える責任を負いません。
          </p>
        </section>

        {/* 第5条 */}
        <section>
          <h2 className="mb-2 text-base font-semibold">第5条（第三者提供）</h2>
          <p>当社は、次のいずれかに該当する場合を除き、個人情報を第三者に提供しません。</p>
          <ul className="mt-1 list-inside list-disc">
            <li>本人の同意がある場合</li>
            <li>法令に基づく場合</li>
            <li>人の生命・身体・財産の保護のために必要であり、本人の同意取得が困難な場合</li>
            <li>公衆衛生の向上または児童の健全な育成の推進のために特に必要な場合</li>
            <li>
              事業の承継に伴って個人情報が提供される場合（この場合、承継先においても本ポリシーと同等の管理が行われるよう努めます）
            </li>
            <li>
              企業ユーザーとの契約に基づき、業務委託に必要な範囲で第三者に提供する場合
              （例：人事システム事業者への OEM 提供等）
            </li>
          </ul>
        </section>

        {/* 第6条 */}
        <section>
          <h2 className="mb-2 text-base font-semibold">第6条（業務委託・OEM 再委託）</h2>
          <p>
            1.
            当社は、本サービスの運営に必要な範囲で、サーバー管理、決済処理、メール配信、AI 推論処理等を外部事業者に委託する場合があります。
          </p>
          <p>
            2.
            OEM パートナーに対して診断エンジンを提供する場合、当社は業務を再委託する立場となることがあります。
            この場合も、当社は委託先・再委託先に対し、適切な監督を行います。
          </p>
        </section>

        {/* 第7条 */}
        <section>
          <h2 className="mb-2 text-base font-semibold">第7条（データの保存期間）</h2>
          <p>
            1.
            個人ユーザーに関するデータは、アカウント削除・退会後、一定期間経過後に当社の定める方法により削除または匿名化します。
          </p>
          <p>
            2.
            企業ユーザーに関するデータの保存期間は、当社と企業ユーザーとの契約内容に従うものとします。
          </p>
          <p>
            3.
            API 利用に関するログデータは、セキュリティおよび障害対応のために一定期間保存し、その後、削除または匿名化します。
          </p>
        </section>

        {/* 第8条 */}
        <section>
          <h2 className="mb-2 text-base font-semibold">第8条（Cookie 等の利用）</h2>
          <p>
            1.
            本サービスでは、ユーザーの利便性向上、アクセス解析、セキュリティ確保のため、Cookie や類似の技術を利用することがあります。
          </p>
          <p>
            2.
            ユーザーはブラウザの設定により Cookie の保存を制限または拒否することができますが、その場合、本サービスの一部機能が利用できないことがあります。
          </p>
        </section>

        {/* 第9条 */}
        <section>
          <h2 className="mb-2 text-base font-semibold">
            第9条（保有個人データの開示・訂正・利用停止等）
          </h2>
          <p>
            ユーザーまたは企業ユーザーの管理者は、当社が保有する自己の個人情報について、開示・訂正・追加・削除・利用停止等を求めることができます。
            これらの請求を行う場合は、下記お問い合わせ窓口までご連絡ください。
          </p>
        </section>

        {/* 第10条 */}
        <section>
          <h2 className="mb-2 text-base font-semibold">第10条（安全管理措置）</h2>
          <p>
            当社は、個人情報の漏えい、滅失またはき損の防止その他個人情報の安全管理のため、アクセス制御、暗号化、ログ管理等の
            必要かつ適切な措置を講じます。
          </p>
        </section>

        {/* 第11条 */}
        <section>
          <h2 className="mb-2 text-base font-semibold">第11条（本ポリシーの変更）</h2>
          <p>
            当社は、必要に応じて本ポリシーを変更することがあります。重要な変更を行う場合は、本サービス上での掲示その他当社が適切と判断する方法により周知します。
          </p>
        </section>

        {/* 第12条 */}
        <section>
          <h2 className="mb-2 text-base font-semibold">第12条（お問い合わせ窓口）</h2>
          <p>本ポリシーに関するお問い合わせは、以下の窓口までご連絡ください。</p>
          <p className="mt-2 whitespace-pre-line">
            Mentor.AI{"\n"}
            〒104-0061{"\n"}
            東京都中央区銀座一丁目22番11号 銀座大竹ビジデンス 2F{"\n"}
            ※郵便物（住所）は必ず 2F までご記入ください。{"\n"}
            メールアドレス：support@mentor-ai.net
          </p>
        </section>

        <p className="text-right text-xs text-slate-500">
          制定日：2025年11月25日　／　最終更新日：2025年12月2日
        </p>

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
