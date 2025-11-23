// app/onboarding/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";

type PlanType = "beta_free" | "student_pro";

export default function OnboardingPage() {
  const router = useRouter();
  const [loadingUser, setLoadingUser] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const [agreed, setAgreed] = useState(false);
  const [plan, setPlan] = useState<PlanType>("beta_free");
  const [contact, setContact] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ① ログインユーザー取得
  useEffect(() => {
    const fetchUser = async () => {
      const { data, error } = await supabaseBrowser.auth.getUser();
      if (error || !data.user) {
        // 未ログインならログイン画面へ
        router.push("/login"); // 実際のログインURLに合わせて変更
        return;
      }
      setUserId(data.user.id);
      setLoadingUser(false);
    };
    fetchUser();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreed) {
      setError("利用規約とプライバシーポリシーへの同意が必要です。");
      return;
    }
    if (!userId) return;

    setError(null);
    setSending(true);

    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authUserId: userId,
          agreed: true,
          planType: plan,
          contact: contact || null,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        console.error("onboarding error:", body);
        throw new Error("failed");
      }

      router.push("/"); // ホームへ
    } catch (e) {
      console.error(e);
      setError("保存に失敗しました。少し時間をおいて再度お試しください。");
    } finally {
      setSending(false);
    }
  };

  if (loadingUser) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-slate-500 text-sm">
        読み込み中…
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-10 space-y-8 px-6">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-slate-400 mb-2">
          Mentor.AI Beta
        </p>
        <h1 className="text-3xl font-semibold text-slate-900 mb-2">
          ご利用前の確認とプラン選択
        </h1>
        <p className="text-base text-slate-600 leading-relaxed">
          Mentor.AI β版では、あなたの就活トレーニングデータをもとに、
          サービス改善のための分析を行うことがあります。
          内容を確認し、同意のうえでご利用ください。
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-6 bg-white/80 backdrop-blur-md border border-white/50 rounded-2xl p-6 shadow-sm"
      >
        {/* ① データ利用・プライバシー */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">
            ① データ利用とプライバシー
          </h2>
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-700 space-y-2 max-h-48 overflow-y-auto">
            <p>
              ・回答内容やスコアは、Mentor.AI のサービス改善・分析のために利用されます。
            </p>
            <p>
              ・個人が特定される形で第三者（企業・学校など）に提供されることはありません。
            </p>
            <p>
              ・センシティブな内容（健康・宗教・家庭事情など）は、統計分析には利用せず、
              あなたのアカウント内のフィードバックのみに使われます。
            </p>
            <p>
              ・アカウント削除やログ削除のリクエストがあれば、できるだけ速やかに対応します。
            </p>
          </div>

          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-slate-300"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
            />
            <span>
              上記の内容と
              <a
                href="/terms"
                className="underline text-sky-600 hover:text-sky-700"
                target="_blank"
              >
                利用規約
              </a>
              ・
              <a
                href="/privacy"
                className="underline text-sky-600 hover:text-sky-700"
                target="_blank"
              >
                プライバシーポリシー
              </a>
              に同意します。
            </span>
          </label>
        </section>

        {/* ② プラン選択 */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">
            ② ご利用プラン
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            <button
              type="button"
              onClick={() => setPlan("beta_free")}
              className={`text-left rounded-2xl border p-4 space-y-1 text-sm ${
                plan === "beta_free"
                  ? "border-sky-500 bg-sky-50"
                  : "border-slate-200 bg-white hover:bg-slate-50"
              }`}
            >
              <p className="text-xs font-semibold text-slate-500 uppercase">
                今だけ
              </p>
              <p className="text-base font-semibold">β版フリープラン</p>
              <p className="text-2xl font-bold text-slate-900">¥0</p>
              <p className="text-xs text-slate-500">
                ケース面接AI・フェルミ推定AI・一般面接AI・ES添削AI すべてβ期間中は無料で利用できます。
              </p>
            </button>

            <button
              type="button"
              onClick={() => setPlan("student_pro")}
              className={`text-left rounded-2xl border p-4 space-y-1 text-sm ${
                plan === "student_pro"
                  ? "border-sky-500 bg-sky-50"
                  : "border-slate-200 bg-white hover:bg-slate-50"
              }`}
            >
              <p className="text-xs font-semibold text-slate-500 uppercase">
                Coming soon
              </p>
              <p className="text-base font-semibold">Student Pro（予定）</p>
              <p className="text-2xl font-bold text-slate-900">¥未定</p>
              <p className="text-xs text-slate-500">
                面接コーチング機能・個別レポート・長期データ保存など、
                有料プランを想定しています。
              </p>
            </button>
          </div>
          <p className="text-xs text-slate-500">
            現在はすべてのユーザーに β版フリープランが適用されます。
            Pro を希望する方は、下の連絡先をご記入ください。
          </p>
        </section>

        {/* ③ 任意の連絡先 */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">
            ③ 任意のご連絡先（希望者のみ）
          </h2>
          <p className="text-xs text-slate-500">
            アップデート情報や、クローズドなモニター募集の案内を受け取りたい方は、メールアドレスか LINE ID をご記入ください。
          </p>
          <input
            type="text"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="メールアドレス or LINE ID（任意）"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400"
          />
        </section>

        {error && (
          <p className="text-sm text-red-500 bg-red-50 rounded-xl px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={sending}
            className="px-6 py-2.5 rounded-full bg-sky-500 text-white text-sm font-medium shadow-sm hover:bg-sky-600 disabled:opacity-50"
          >
            {sending ? "保存中..." : "Mentor.AI をはじめる"}
          </button>
        </div>
      </form>
    </div>
  );
}
