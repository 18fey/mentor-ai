// src/components/Settings.tsx
"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

type Database = any;

function createClientSupabase() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

const Settings: React.FC = () => {
  const router = useRouter();
  const supabase = createClientSupabase();

  // アカウント
  const [loadingAccount, setLoadingAccount] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  // Meta
  const [metaBalance, setMetaBalance] = useState<number | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [metaError, setMetaError] = useState<string | null>(null);

  // データ削除
  const [deleting, setDeleting] = useState(false);

  // ---------------------------
  // アカウント情報取得
  // ---------------------------
  useEffect(() => {
    const fetchAccount = async () => {
      try {
        setLoadingAccount(true);
        const { data, error } = await supabase.auth.getUser();

        if (error || !data.user) {
          console.warn("ログインユーザーを取得できませんでした", error);
          setUserId(null);
          setEmail(null);
          return;
        }

        setUserId(data.user.id);
        setEmail(data.user.email ?? null);
      } catch (e) {
        console.error("fetchAccount exception:", e);
      } finally {
        setLoadingAccount(false);
      }
    };

    fetchAccount();
  }, [supabase]);

  // ---------------------------
  // Meta残高取得（RPC: get_my_meta_balance）
  // ---------------------------
  const fetchMetaBalance = async () => {
    try {
      setLoadingMeta(true);
      setMetaError(null);

      const { data, error } = await supabase.rpc("get_my_meta_balance");

      if (error) {
        console.error("[meta] get_my_meta_balance error:", error);
        setMetaError("Meta残高の取得に失敗しました。");
        setMetaBalance(null);
        return;
      }

      // data が number / {balance:number} / それ以外 を吸収
      const n =
        typeof data === "number"
          ? data
          : data && typeof data === "object" && "balance" in (data as any)
          ? Number((data as any).balance)
          : Number(data);

      setMetaBalance(Number.isFinite(n) ? n : 0);
    } catch (e) {
      console.error("[meta] fetchMetaBalance exception:", e);
      setMetaError("Meta残高の取得中にエラーが発生しました。");
      setMetaBalance(null);
    } finally {
      setLoadingMeta(false);
    }
  };

  useEffect(() => {
    if (!userId) return;
    fetchMetaBalance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // ---------------------------
  // ログアウト
  // ---------------------------
  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      router.push("/login");
      router.refresh();
    }
  };

  // ---------------------------
  // データ削除（＝削除リクエストの提出）
  // ---------------------------
  const handleDeleteData = async () => {
    if (
      !window.confirm(
        "面接ログやストーリーカードなど、あなたのデータ削除リクエストを受け付けます。\nこの操作は取り消せません。本当に実行しますか？"
      )
    ) {
      return;
    }

    try {
      setDeleting(true);
      const res = await fetch("/api/data/delete", { method: "POST" });

      if (!res.ok) {
        console.error("delete request failed:", await res.text());
        alert("削除リクエストの送信に失敗しました。時間をおいて再度お試しください。");
        return;
      }

      const json = await res.json().catch(() => null);
      if (json?.deduped) {
        alert("削除リクエストはすでに受け付け済みです。対応をお待ちください。");
        return;
      }

      alert("削除リクエストを受け付けました。対応までしばらくお待ちください。");
    } catch (e) {
      console.error(e);
      alert("削除リクエスト送信中にエラーが発生しました。ネットワーク状況をご確認ください。");
    } finally {
      setDeleting(false);
    }
  };

  // ---------------------------
  // データダウンロード（準備中：APIとは接続しない）
  // ---------------------------
  const handleExportComingSoon = () => {
    alert("データエクスポート機能は現在準備中です。もう少しお待ちください。");
  };

  return (
    <div className="h-full w-full px-10 py-8">
      <header className="mb-8">
        <h1 className="mb-2 text-2xl font-semibold text-slate-900">設定</h1>
        <p className="text-sm leading-relaxed text-slate-500">
          アカウント、Meta残高、データとプライバシーの管理を行う画面です。
        </p>
      </header>

      <div className="max-w-4xl space-y-6">
        {/* アカウント */}
        <section className="rounded-2xl border border-slate-100 bg-white/80 p-6 shadow-sm backdrop-blur">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">アカウント</h2>

          {loadingAccount ? (
            <p className="text-xs text-slate-500">読み込み中...</p>
          ) : userId ? (
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs text-slate-500">ログイン中</p>
                <p className="text-sm font-semibold text-slate-900">
                  {email ?? "（メール不明）"}
                </p>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
              >
                ログアウト
              </button>
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              ログイン情報を取得できませんでした。再読み込みしてください。
            </p>
          )}
        </section>

        {/* Meta */}
        <section className="rounded-2xl border border-slate-100 bg-white/80 p-6 shadow-sm backdrop-blur">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Meta</h2>
            <button
              type="button"
              onClick={fetchMetaBalance}
              disabled={!userId || loadingMeta}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              {loadingMeta ? "更新中..." : "更新"}
            </button>
          </div>

          {metaError ? (
            <p className="text-xs text-rose-600">{metaError}</p>
          ) : (
            <div className="flex items-end gap-3">
              <p className="text-[11px] text-slate-500">現在の残高</p>
              <p className="text-2xl font-semibold text-slate-900">
                {metaBalance === null ? "—" : metaBalance}
              </p>
              <p className="pb-1 text-[11px] text-slate-500">meta</p>
            </div>
          )}

          <p className="mt-2 text-[11px] text-slate-500">
            残高は数秒で反映されます。反映されない場合は「更新」を押してください。
          </p>
        </section>

        {/* データとプライバシー */}
        <section className="mb-10 rounded-2xl border border-slate-200 bg-white/80 px-4 py-4 shadow-sm">
          <h2 className="mb-1 text-sm font-semibold text-slate-900">
            データとプライバシー
          </h2>

          <p className="mb-3 text-[11px] leading-relaxed text-slate-600">
            詳細は{" "}
            <Link href="/privacy" className="underline underline-offset-2">
              プライバシーポリシー
            </Link>{" "}
            をご覧ください。利用規約は{" "}
            <Link href="/terms" className="underline underline-offset-2">
              利用規約
            </Link>
            に掲載しています。
          </p>

          <div className="space-y-2 text-[11px] text-slate-700">
            {/* 削除リクエスト */}
            <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-semibold text-slate-800">データ削除リクエスト</p>
                  <p className="mt-1 text-[11px] text-slate-600">
                    面接ログやスコア履歴などの削除をリクエストできます（取り消し不可）。
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleDeleteData}
                  disabled={deleting}
                  className="inline-flex items-center justify-center rounded-full border border-rose-300 bg-rose-50 px-3 py-1.5 text-[11px] font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                >
                  {deleting ? "送信中..." : "削除をリクエスト"}
                </button>
              </div>
            </div>

            {/* エクスポート（準備中） */}
            <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-semibold text-slate-800">データエクスポート</p>
                  <p className="mt-1 text-[11px] text-slate-600">
                    あなたのデータをエクスポートする機能は現在準備中です。
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleExportComingSoon}
                  disabled
                  className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-500 opacity-60 cursor-not-allowed"
                >
                  準備中
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Settings;
