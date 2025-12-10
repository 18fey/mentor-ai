// app/meta-demo/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FeatureActionButton } from "@/components/FeatureActionButton";

export default function MetaDemoPage() {
  const router = useRouter();
  const [log, setLog] = useState<string>("まだ何も実行していません。");
  const [showMetaModal, setShowMetaModal] = useState(false);

  const fakeRun = async (label: string) => {
    // 実際はここにAI実行を入れる
    setLog(`「${label}」が実行されました。`);
    // ちょっとだけ待たせるデモ
    await new Promise((r) => setTimeout(r, 400));
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#F5FAFF] to-white px-6 py-10">
      <div className="mx-auto max-w-3xl space-y-8">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold text-slate-900">
            Meta ロックUI デモ
          </h1>
          <p className="text-sm text-slate-500">
            free / meta / pro の3状態がどう見えるか、ここで一度確認できるテストページです。
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          {/* free */}
          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <h2 className="mb-2 text-sm font-semibold text-slate-800">
              無料で使える状態（free）
            </h2>
            <p className="mb-3 text-xs text-slate-500">
              青ボタン。Metaを使わずにそのままAIを実行。
            </p>
            <FeatureActionButton
              feature="es_check"
              label="ES添削（無料サンプル）"
              lockState="free"
              onRun={() => fakeRun("ES添削（無料）")}
            />
          </div>

          {/* meta */}
          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <h2 className="mb-2 text-sm font-semibold text-slate-800">
              Metaが必要な状態（meta）
            </h2>
            <p className="mb-3 text-xs text-slate-500">
              黄色ボタン。「3 Meta」などの消費量を表示してから実行。
            </p>
            <FeatureActionButton
              feature="interview_10"
              label="AI一般面接（10問）"
              lockState="meta"
              metaCost={3}
              onRun={() => fakeRun("AI一般面接（10問）")}
              onRequireMetaTopUp={() => {
                setShowMetaModal(true);
                setLog("Metaが不足しています。");
              }}
            />
          </div>

          {/* pro */}
          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <h2 className="mb-2 text-sm font-semibold text-slate-800">
              Pro限定の状態（pro）
            </h2>
            <p className="mb-3 text-xs text-slate-500">
              鍵アイコン＋グレー。クリックするとプランページへ誘導。
            </p>
            <FeatureActionButton
              feature="deep_16type"
              label="16タイプ Deep レポート"
              lockState="pro"
              onRun={async () => {}}
              onOpenPlanPage={() => router.push("/plans")}
            />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold text-slate-800">ログ</h2>
          <p className="text-xs text-slate-600 whitespace-pre-wrap">{log}</p>
        </section>

        {showMetaModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
              <h3 className="mb-2 text-sm font-semibold text-slate-900">
                Metaが不足しています
              </h3>
              <p className="mb-4 text-xs text-slate-600">
                この機能を利用するには、追加でMetaを購入する必要があります。
              </p>
              <div className="flex justify-end gap-2 text-xs">
                <button
                  className="rounded-xl border border-slate-200 px-3 py-1.5 text-slate-600"
                  onClick={() => setShowMetaModal(false)}
                >
                  閉じる
                </button>
                <button
                  className="rounded-xl bg-amber-500 px-3 py-1.5 text-white"
                  onClick={() => {
                    setShowMetaModal(false);
                    // 購入ページに飛ばす場合
                    // router.push("/meta/buy");
                  }}
                >
                  Metaを購入する
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
