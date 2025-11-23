// app/error.tsx
"use client";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  console.error("Global error:", error);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="max-w-md rounded-3xl bg-white shadow-lg p-6 space-y-3">
        <h1 className="text-lg font-semibold text-slate-900">
          画面の表示中にエラーが発生しました
        </h1>
        <p className="text-sm text-slate-500">
          どこかのページまたはコンポーネントで問題が起きています。
          「再読み込み」を押しても直らない場合は、最近変更したページのコードを確認してみてください。
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-2 inline-flex items-center justify-center rounded-full bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700"
        >
          再読み込み
        </button>
      </div>
    </div>
  );
}



