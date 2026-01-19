// app/service/page.tsx
export default function ServicePage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      {/* Header */}
      <header className="mb-10">
        <p className="text-[11px] font-semibold tracking-[0.25em] text-slate-500">
          ELITE CAREER PLATFORM
        </p>
        <h1 className="mt-2 text-3xl font-semibold leading-snug text-slate-900">
          Mentor.AI サービス概要
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-700">
          Mentor.AIは、就職活動を「根性」ではなく「戦略」に変えるための、AIキャリア支援プラットフォームです。
          ケース・フェルミ・一般面接・ES・自己分析を一つの導線にまとめ、学習と改善の“型”を作ります。
        </p>

        <div className="mt-6 rounded-3xl border border-slate-200 bg-white/60 px-6 py-4 shadow-[0_18px_45px_rgba(15,23,42,0.06)] backdrop-blur-[18px]">
          <p className="text-sm font-semibold text-slate-900">AIと一緒に、あなた専属の就活戦略を。</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">
            あなたの回答・思考プロセスをもとに、練習→評価→改善→継続の流れを回せるように設計しています。
          </p>
        </div>
      </header>

      {/* What it does */}
      <section className="mb-12">
        <h2 className="mb-4 text-xl font-semibold text-slate-900">提供機能</h2>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-white/60 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)] backdrop-blur-[18px]">
            <h3 className="text-sm font-semibold text-slate-900">面接練習と即時フィードバック</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-700">
              一般面接・ケース・フェルミなどを、練習→評価→改善案までワンストップで支援します。
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white/60 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)] backdrop-blur-[18px]">
            <h3 className="text-sm font-semibold text-slate-900">思考力トレーニング</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-700">
              ロジカル・構造化・仮説思考など、選考で再現性が出る「考え方の型」を鍛える設計です。
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white/60 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)] backdrop-blur-[18px]">
            <h3 className="text-sm font-semibold text-slate-900">ES添削・改善提案</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-700">
              文章のわかりやすさだけでなく、主張の一貫性・根拠・構造の改善まで提案します。
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white/60 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)] backdrop-blur-[18px]">
            <h3 className="text-sm font-semibold text-slate-900">学習の見える化（ダッシュボード）</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-700">
              練習履歴やフィードバックを蓄積し、次にやるべきことが分かる形に整理します。
            </p>
          </div>
        </div>
      </section>

      {/* Who it's for */}
      <section className="mb-12">
        <h2 className="mb-4 text-xl font-semibold text-slate-900">対象ユーザー</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-slate-700">
          <li>大学生・大学院生（就活準備〜選考中）</li>
          <li>ケース／フェルミ／一般面接の練習を継続したい方</li>
          <li>ESや自己分析の「型」を作り、再現性を上げたい方</li>
          <li>学習の進捗を可視化し、迷わず改善したい方</li>
        </ul>
      </section>

      {/* Safety & notes */}
      <section className="mb-12">
        <h2 className="mb-4 text-xl font-semibold text-slate-900">AI利用と注意事項</h2>

        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
          <ul className="space-y-2 text-sm leading-relaxed text-slate-700">
            <li>
              ・本サービスは外部AIモデルを利用して出力を生成します。出力は統計的推定に基づくものであり、正確性・完全性を保証するものではありません。
            </li>
            <li>
              ・診断結果や提案は参考情報であり、採用選考の合否を保証するものではありません。最終判断はユーザーご自身の責任で行ってください。
            </li>
            <li>
              ・個人情報の取り扱い、Cookie等については{" "}
              <a href="/privacy" className="font-medium text-sky-700 underline-offset-2 hover:underline">
                プライバシーポリシー
              </a>{" "}
              をご確認ください。
            </li>
            <li>
              ・利用条件の詳細は{" "}
              <a href="/terms" className="font-medium text-sky-700 underline-offset-2 hover:underline">
                利用規約
              </a>{" "}
              をご確認ください。
            </li>
          </ul>
        </div>
      </section>

      {/* Operator */}
      <section>
        <h2 className="mb-4 text-xl font-semibold text-slate-900">運営情報</h2>
        <div className="rounded-3xl border border-slate-200 bg-white/60 p-6 text-sm text-slate-700 shadow-[0_18px_45px_rgba(15,23,42,0.06)] backdrop-blur-[18px]">
          <div className="space-y-1">
            <p>サービス名：Mentor.AI</p>
            <p>運営形態：個人事業（Mentor.AI）</p>
            <p>所在地：東京都（バーチャルオフィス利用）</p>
            <p>
              お問い合わせ：{" "}
              <a
                href="mailto:support@mentor-ai.net"
                className="font-medium text-sky-700 underline-offset-2 hover:underline"
              >
                support@mentor-ai.net
              </a>
            </p>
          </div>
          <p className="mt-4 text-[11px] leading-relaxed text-slate-500">
            ※ サービス内容は改善のため予告なく更新される場合があります。
          </p>
        </div>
      </section>
    </main>
  );
}
