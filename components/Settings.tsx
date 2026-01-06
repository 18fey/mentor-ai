// src/components/Settings.tsx
"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
// v7 → v8: auth-helpers を廃止し、@supabase/ssr のブラウザクライアントに変更
import { createBrowserClient } from "@supabase/ssr";
import { PayjpCheckoutButton } from "@/components/PayjpCheckoutButton";

// プラン型
type AppPlan = "free" | "pro";

// 決済履歴表示用の型（APIの戻りに合わせて調整OK）
type BillingHistoryItem = {
  id: string;
  plan: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string; // ISO文字列想定
};

// 利用状況ダッシュボード用
type UsageItem = {
  featureKey: string;
  label: string;
  description: string;
  count: number;
  limit: number | null; // null = 無制限
};

type UsageSummaryResponse = {
  plan: AppPlan;
  betaUser: boolean;
  planStartedAt: string | null;
  usage: {
    caseInterview: { count: number; limit: number | null };
    fermi: { count: number; limit: number | null };
    generalInterview: { count: number; limit: number | null };
    aiTraining: { count: number; limit: number | null };
    esCorrection: { count: number; limit: number | null };
  };
};

/* -------------------------------
   v8 Supabase Client（Component用）
-------------------------------- */
function createClientSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

const Settings: React.FC = () => {
  const supabase = createClientSupabase();

  const [plan, setPlan] = useState<AppPlan>("free");
  const [loadingProfile, setLoadingProfile] = useState(true);

  // ログインユーザーID（terms 更新などで使う）
  const [userId, setUserId] = useState<string | null>(null);

  // 利用規約同意フラグ
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false);
  const [acceptingTerms, setAcceptingTerms] = useState(false);

  // データ削除／ダウンロード用の状態
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);

  // 決済履歴
  const [billingHistory, setBillingHistory] = useState<BillingHistoryItem[]>([]);
  const [loadingBilling, setLoadingBilling] = useState(false);
  const [billingError, setBillingError] = useState<string | null>(null);

  // 利用状況ダッシュボード
  const [usage, setUsage] = useState<UsageItem[]>([]);
  const [loadingUsage, setLoadingUsage] = useState(false);
  const [usageError, setUsageError] = useState<string | null>(null);

  // ---------------------------
  // ログインユーザー → users_profile を保証 & plan / terms を取得
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
        setUserId(user.id);

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

        // ③ 返ってきた plan / 利用規約ステータス を state に反映
        const profile = json?.profile ?? json;
        if (profile?.plan) {
          setPlan(profile.plan as AppPlan);
        }

        if (profile?.accepted_terms_at || profile?.has_accepted_terms) {
          setHasAcceptedTerms(true);
        }
      } catch (e) {
        console.error("fetchProfile exception:", e);
      } finally {
        setLoadingProfile(false);
      }
    };

    fetchProfile();
  }, [supabase]);

  // ---------------------------
  // 利用状況 summary の取得（課金ダッシュボード用）
  // ---------------------------
  useEffect(() => {
    const fetchUsage = async () => {
      try {
        setLoadingUsage(true);
        setUsageError(null);

        const res = await fetch("/api/usage/summary");
        if (!res.ok) {
          const text = await res.text();
          console.warn("usage summary not available:", text);
          setUsageError(
            "利用状況ダッシュボードはまだ有効化されていません。（/api/usage/summary 未実装）"
          );
          return;
        }

        const data: UsageSummaryResponse = await res.json();

        // plan が返ってきていれば念のため同期
        if (data.plan) {
          setPlan(data.plan);
        }

        const list: UsageItem[] = [
          {
            featureKey: "caseInterview",
            label: "ケース面接AI",
            description: "コンサル・総合商社・外銀向けのケース面接トレーニング。",
            count: data.usage.caseInterview.count,
            limit: data.usage.caseInterview.limit,
          },
          {
            featureKey: "fermi",
            label: "フェルミ推定AI",
            description: "フェルミ推定の型トレーニング。式の設計〜オーダーチェックまで。",
            count: data.usage.fermi.count,
            limit: data.usage.fermi.limit,
          },
          {
            featureKey: "generalInterview",
            label: "一般面接AI（音声版）",
            description: "自己PR・志望動機などの模擬面接セッション。",
            count: data.usage.generalInterview.count,
            limit: data.usage.generalInterview.limit,
          },
          {
            featureKey: "aiTraining",
            label: "AI思考トレーニング",
            description: "AIへの指示力・編集力を鍛える5ステップ演習。",
            count: data.usage.aiTraining.count,
            limit: data.usage.aiTraining.limit,
          },
          {
            featureKey: "esCorrection",
            label: "スコアリング",
            description:
              "構成・ロジック・文字数フィットなどの自動チェック（詳細フィードバックは PRO）。",
            count: data.usage.esCorrection.count,
            limit: data.usage.esCorrection.limit,
          },
        ];

        setUsage(list);
      } catch (e) {
        console.error("fetchUsage error:", e);
        setUsageError(
          "利用状況の取得中にエラーが発生しました。時間をおいて再度お試しください。"
        );
      } finally {
        setLoadingUsage(false);
      }
    };

    fetchUsage();
  }, []);

  // ---------------------------
  // 決済履歴の取得
  // ---------------------------
  useEffect(() => {
    const fetchBillingHistory = async () => {
      try {
        setLoadingBilling(true);
        setBillingError(null);

        const res = await fetch("/api/billing/history", {
          method: "GET",
        });

        if (!res.ok) {
          // API未実装でも落ちないように
          const text = await res.text();
          console.warn("billing history not available:", text);
          setBillingError(
            "まだ決済履歴は取得できません。正式リリース時に有効化されます。"
          );
          return;
        }

        const json = await res.json();
        const items: BillingHistoryItem[] = json?.items ?? json ?? [];
        setBillingHistory(items);
      } catch (e) {
        console.error("fetchBillingHistory error:", e);
        setBillingError(
          "決済履歴の取得中にエラーが発生しました。時間をおいて再度お試しください。"
        );
      } finally {
        setLoadingBilling(false);
      }
    };

    fetchBillingHistory();
  }, []);

  // 表示用ラベル
  const planLabel =
    loadingProfile
      ? "読み込み中..."
      : plan === "pro"
      ? "PRO"
      : "FREE";

  // ---------------------------
  // 利用規約への同意
  // ---------------------------
  const handleAcceptTerms = async () => {
    if (!userId) {
      alert("ログイン情報を取得できませんでした。再読み込みしてからお試しください。");
      return;
    }

    try {
      setAcceptingTerms(true);
      const res = await fetch("/api/accept-terms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("accept terms failed:", text);
        alert(
          "利用規約への同意を保存できませんでした。時間をおいて再度お試しください。"
        );
        return;
      }

      setHasAcceptedTerms(true);
      alert("利用規約への同意が保存されました。");
    } catch (e) {
      console.error(e);
      alert(
        "利用規約への同意中にエラーが発生しました。ネットワーク状況をご確認ください。"
      );
    } finally {
      setAcceptingTerms(false);
    }
  };

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
      alert(
        "データ削除中にエラーが発生しました。ネットワーク状況をご確認ください。"
      );
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

  // 利用状況バー用
  const renderUsageSection = () => {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              今月の利用状況（機能別）
            </h2>
            <p className="text-[11px] text-slate-500">
              ケース・フェルミ・一般面接・AI思考トレーニング・ES添削の利用回数をまとめて確認できます。
              FREE プランでは上限に達すると各画面でロック表示が出ます。
            </p>
          </div>
          <span className="rounded-full bg-slate-50 px-2.5 py-0.5 text-[10px] text-slate-500">
            {loadingUsage ? "同期中..." : "今月分のカウント"}
          </span>
        </div>

        {usageError ? (
          <p className="text-[11px] text-slate-500">{usageError}</p>
        ) : usage.length === 0 ? (
          <p className="text-[11px] text-slate-500">
            まだ利用状況データがありません。
          </p>
        ) : (
          <div className="space-y-3">
            {usage.map((u) => {
              const limitLabel =
                u.limit === null
                  ? plan === "pro"
                    ? "無制限"
                    : "制限なし"
                  : `${u.limit} 回 / 月`;
              const ratio =
                u.limit && u.limit > 0
                  ? Math.min(100, Math.round((u.count / u.limit) * 100))
                  : 0;

              const barColor =
                u.limit && u.limit > 0 && ratio >= 100
                  ? "bg-rose-400"
                  : u.limit && u.limit > 0 && ratio >= 70
                  ? "bg-amber-400"
                  : "bg-sky-500";

              return (
                <div
                  key={u.featureKey}
                  className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold text-slate-800">
                        {u.label}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {u.description}
                      </p>
                    </div>
                    <div className="text-right text-[11px]">
                      <p className="font-semibold text-slate-800">
                        {u.count}
                        {u.limit ? ` / ${u.limit} 回` : " 回"}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {limitLabel}
                      </p>
                    </div>
                  </div>

                  {u.limit && u.limit > 0 && (
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/80">
                      <div
                        className={`h-full rounded-full ${barColor}`}
                        style={{ width: `${ratio}%` }}
                      />
                    </div>
                  )}

                  {u.limit && u.count >= u.limit && (
                    <p className="mt-1 text-[10px] font-semibold text-rose-600">
                      今月の FREE プラン上限に達しました。PRO にアップグレードすると、ほぼ無制限で利用できます。
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    );
  };

  return (
    <div className="h-full w-full px-10 py-8">
      {/* タイトル */}
      <header className="mb-8">
        <h1 className="mb-2 text-2xl font-semibold text-slate-900">設定</h1>
        <p className="text-sm leading-relaxed text-slate-500">
          アカウント情報・プラン（課金）の確認、利用規約の同意、データとプライバシーの管理などを行う画面です。
        </p>
      </header>

      <div className="max-w-4xl space-y-6">
        {/* 🔐 利用規約・オンボーディング状態 */}
        <section className="rounded-2xl border border-slate-100 bg-white/80 p-6 shadow-sm backdrop-blur">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">
            利用開始ステータス（利用規約・オンボーディング）
          </h2>

          {hasAcceptedTerms ? (
            <div className="flex flex-col gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-xs text-emerald-900">
              <p className="font-semibold">利用規約に同意済みです。</p>
              <p>
                Mentor.AI の全機能を利用できます。
                必要に応じて、いつでも下記リンクから利用規約・プライバシーポリシーを再確認できます。
              </p>
            </div>
          ) : (
            <div className="space-y-3 rounded-xl border border-amber-300 bg-amber-50/80 px-4 py-3 text-xs text-amber-900">
              <p className="font-semibold">
                まだ利用規約に同意していません。（β版オンボーディング未完了）
              </p>
              <p>
                Mentor.AI を継続利用するには、利用規約・プライバシーポリシーを確認のうえ同意をお願いします。
                今後、初回アクセス時には規約同意モーダルで同じ内容を表示する想定です。
              </p>
              <button
                type="button"
                onClick={handleAcceptTerms}
                disabled={acceptingTerms}
                className="inline-flex items-center justify-center rounded-full bg-amber-600 px-4 py-1.5 text-[11px] font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
              >
                {acceptingTerms ? "保存中..." : "利用規約に同意して利用を開始する"}
              </button>
            </div>
          )}

          <p className="mt-3 text-[11px] text-slate-500">
            利用規約およびプライバシーポリシーは、いつでもこちらから確認できます：{" "}
            <Link href="/terms" className="underline underline-offset-2">
              利用規約
            </Link>{" "}
            /{" "}
            <Link href="/privacy" className="underline underline-offset-2">
              プライバシーポリシー
            </Link>
            。
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
              <p className="mt-1 text-[11px] text-slate-500">
                決済完了後、サーバー側でプラン情報が更新されると、この画面のプラン表示も自動的に
                PRO に切り替わります（PAY.JP Webhook → Supabase更新を想定）。
              </p>
            </div>

            {/* 🎯 月額 2,900 円 に設定（amount=3980 は必要に応じて修正してね） */}
            <div className="flex flex-col items-start gap-1">
              <PayjpCheckoutButton
                amount={3980}
                label="PROプランにアップグレード（月額¥2,980）"
              />
              <span className="text-[11px] text-slate-500">
                PAY.JP を通じて安全に決済されます。
              </span>
            </div>
          </div>
        </section>

        {/* 利用状況ダッシュボード */}
        {renderUsageSection()}

        {/* ✅ 決済履歴表示 */}
        <section className="rounded-2xl border border-slate-100 bg-white/80 p-6 shadow-sm backdrop-blur">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">
            決済履歴
          </h2>
          <p className="mb-3 text-[11px] text-slate-600">
            Mentor.AI の有料プランに関する請求履歴を確認できます。
            β期間中や未課金ユーザーの場合、履歴は表示されない場合があります。
          </p>

          {loadingBilling ? (
            <p className="text-xs text-slate-500">決済履歴を読み込んでいます...</p>
          ) : billingError ? (
            <p className="text-xs text-slate-500">{billingError}</p>
          ) : billingHistory.length === 0 ? (
            <p className="text-xs text-slate-500">
              現在表示できる決済履歴はありません。
            </p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-100 bg-white">
              <table className="min-w-full border-collapse text-xs">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-3 py-2 text-left">日時</th>
                    <th className="px-3 py-2 text-left">プラン</th>
                    <th className="px-3 py-2 text-right">金額</th>
                    <th className="px-3 py-2 text-left">ステータス</th>
                  </tr>
                </thead>
                <tbody>
                  {billingHistory.map((item) => (
                    <tr key={item.id} className="border-t border-slate-100">
                      <td className="px-3 py-2">
                        {new Date(item.createdAt).toLocaleString("ja-JP")}
                      </td>
                      <td className="px-3 py-2">{item.plan}</td>
                      <td className="px-3 py-2 text-right">
                        {item.amount.toLocaleString("ja-JP")} {item.currency}
                      </td>
                      <td className="px-3 py-2">
                        <span className="rounded-full bg-slate-50 px-2 py-0.5 text-[10px] text-slate-700">
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* データとプライバシー */}
        <section className="mb-10 rounded-2xl border border-slate-200 bg-white/80 px-4 py-4 shadow-sm">
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
