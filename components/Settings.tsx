// src/components/Settings.tsx
"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { PayjpCheckoutButton } from "@/components/PayjpCheckoutButton";

// プラン型
type AppPlan = "free" | "beta" | "pro";

const Settings: React.FC = () => {
  const supabase = createClientComponentClient();
  const [plan, setPlan] = useState<AppPlan>("free");
  const [loadingProfile, setLoadingProfile] = useState(true);

  // データ削除／ダウンロード用の状態
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);

  // ---------------------------
  // ログインユーザー → users_profile を保証 & plan を取得
  // ---------------------------
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        // ① Supabase Auth からログインユーザー取得
        const { data, error } = await supabase.auth.getUser();

        if (error || !data.user) {
          console.warn("ログインユーザーを取得できませんでした", error);
          return;
        }

        const user = data.user;

        // ② /api/profile/ensure を叩いて users_profile を自動作成 / 取得
        const res = await fetch("/api/profile/ensure", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user.id,
            email: user.email,
          }),
        });

        if (!res.ok) {
          console.error("ensure profile failed:", await res.text());
          return;
        }

        const json = await res.json().catch(() => null);

        // ③ 返ってきた plan を state に反映
        const profile = json?.profile ?? json;
        if (profile?.plan) {
          setPlan(profile.plan as AppPlan);
        }
      } catch (e) {
        console.error("fetchProfile exception:", e);
      } finally {
        setLoadingProfile(false);
      }
    };

    fetchProfile();
  }, [supabase]);

  // 表示用ラベル
  const planLabel =
    loadingProfile
      ? "読み込み中..."
      : plan === "beta"
      ? "βテスト（有料）"
      : plan === "pro"
      ? "PRO"
      : "FREE（βテスト）";

  // ---------------------------
  // データ削除ボタン
  // ---------------------------
  const handleDeleteData = async () => {
    if (
      !window.confirm(
        "面接ログやストーリーカードなど、あなたのデータを削除します。\nこの操作は取り消せません。本当に実行しますか？"
      )
    ) {
      return;
    }

    try {
      setDeleting(true);
      const res = await fetch("/api/data/delete", {
        method: "POST",
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("delete failed:", text);
        alert("データ削除に失敗しました。時間をおいて再度お試しください。");
        return;
      }

      alert("あなたのデータ削除リクエストが完了しました。");
    } catch (e) {
      console.error(e);
      alert("データ削除中にエラーが発生しました。ネットワーク状況をご確認ください。");
    } finally {
      setDeleting(false);
    }
  };

  // ---------------------------
  // データダウンロードボタン
  // ---------------------------
  const handleDownloadData = async () => {
    try {
      setExporting(true);
      const res = await fetch("/api/data/export", {
        method: "GET",
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("export failed:", text);
        alert("データのダウンロードに失敗しました。");
        return;
      }

      const json = await res.json();

      // JSON をファイルとしてダウンロード
      const blob = new Blob([JSON.stringify(json, null, 2)], {
        type: "application/json",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");

      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, "0");
      const d = String(now.getDate()).padStart(2, "0");

      a.href = url;
      a.download = `mentorai-data-${y}${m}${d}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert("データのダウンロード中にエラーが発生しました。");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="h-full w-full px-10 py-8">
      {/* タイトル */}
      <header className="mb-8">
        <h1 className="mb-2 text-2xl font-semibold text-slate-900">
          設定
        </h1>
        <p className="text-sm leading-relaxed text-slate-500">
          アカウント情報・プラン（課金）の確認、データとプライバシーの管理などを行う画面です。
        </p>
      </header>

      <div className="max-w-4xl space-y-6">
        {/* 説明カード */}
        <section className="rounded-2xl border border-slate-100 bg-white/70 p-6 text-sm text-slate-600 shadow-sm backdrop-blur">
          <p className="mb-2">
            今後、この画面から「プロフィール編集」「志望業界・企業の登録」
            「通知設定」などを順次追加していきます。
          </p>
          <p>
            まずはプラン表示・決済・データの扱いを整え、ローンチに必要な安全性と透明性を確保しています。
          </p>
        </section>

        {/* プラン / お支払い */}
        <section className="rounded-2xl border border-slate-100 bg-white/80 p-6 shadow-sm backdrop-blur">
          <h2 className="mb-1 text-lg font-semibold text-slate-900">
            プラン / お支払い
          </h2>
          <p className="mb-4 text-xs leading-relaxed text-slate-500">
            Mentor.AI の有料プランは決済代行サービス「PAY.JP」を利用して安全に決済されます。
            クレジットカード情報は PAY.JP 側で管理され、Mentor.AI 側では保持しません。
          </p>

          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm text-slate-700">
                現在のプラン：
                <span className="ml-1 font-semibold">{planLabel}</span>
              </p>
              <p className="mt-1 text-xs text-slate-500">
                PROプランでは、より詳細なフィードバックやスコア履歴の保存など、
                追加機能が利用できます。
              </p>
              <p className="mt-2 text-[11px] text-slate-500">
                料金や機能の詳細は{" "}
                <Link href="/pricing" className="underline underline-offset-2">
                  プラン・料金ページ
                </Link>
                をご確認ください。
              </p>
            </div>

            {/* 金額は pricing ページと合わせて調整してOK */}
            <PayjpCheckoutButton
              amount={1980}
              label="PROプランにアップグレード（月額¥1,980）"
            />
          </div>
        </section>

        {/* データとプライバシー */}
        <section className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-4 shadow-sm">
          <h2 className="mb-1 text-sm font-semibold text-slate-900">
            データとプライバシー
          </h2>
          <p className="mb-3 text-[11px] leading-relaxed text-slate-600">
            Mentor.AI では、就活やキャリア支援のために入力されたデータのみを扱います。
            あなたのデータは「一緒に整理していく資産」として扱い、不要な情報は取得しません。
            詳細は{" "}
            <Link href="/privacy" className="underline underline-offset-2">
              プライバシーポリシー
            </Link>
            をご覧ください。
          </p>

          <div className="space-y-2 text-[11px] text-slate-700">
            {/* データの扱い説明 */}
            <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2">
              <p className="font-semibold text-slate-800">
                あなたのデータの扱いについて
              </p>
              <ul className="mt-1 list-disc space-y-1 pl-4">
                <li>
                  入力内容は、面接トレーニングと自己分析フィードバックの目的にのみ利用します。
                </li>
                <li>第三者への提供や広告目的での利用は行いません。</li>
                <li>
                  センシティブな内容を含むセッションは、統計分析やレポートの要約から除外されます。
                </li>
              </ul>
            </div>

            {/* データ削除ボタン */}
            <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-semibold text-slate-800">
                    データ削除リクエスト
                  </p>
                  <p className="mt-1 text-[11px] text-slate-600">
                    自分の面接ログやストーリーカード、スコア履歴などを削除したい場合に利用できます。
                    削除されたデータは復元されません。
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleDeleteData}
                  disabled={deleting}
                  className="inline-flex items-center justify-center rounded-full border border-rose-300 bg-rose-50 px-3 py-1.5 text-[11px] font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                >
                  {deleting ? "削除処理中..." : "データを削除する"}
                </button>
              </div>
            </div>

            {/* データダウンロードボタン */}
            <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-semibold text-slate-800">
                    データダウンロード
                  </p>
                  <p className="mt-1 text-[11px] text-slate-600">
                    ストーリーカードやフィードバック履歴など、あなたのデータをJSON形式で一括ダウンロードできます。
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadData}
                  disabled={exporting}
                  className="inline-flex items-center justify-center rounded-full border border-sky-300 bg-sky-50 px-3 py-1.5 text-[11px] font-semibold text-sky-700 hover:bg-sky-100 disabled:opacity-60"
                >
                  {exporting ? "準備中..." : "データをダウンロード"}
                </button>
              </div>
            </div>

            <p className="pt-1 text-[10px] text-slate-500">
              利用規約は{" "}
              <Link href="/terms" className="underline underline-offset-2">
                利用規約ページ
              </Link>
              に掲載しています。
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Settings;
