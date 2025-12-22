// app/profile/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

/* ------------------------------
   v8 Supabase Client（Component用）
--------------------------------*/
function createClientSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// =========================
// 型定義（profiles 用）
// =========================

type ProfileRow = {
  id: string; // profiles のPK（uuid）
  auth_user_id: string | null; // auth.users.id
  display_name: string | null;
  affiliation: string | null;
  status: string | null; // 学生 / 社会人 など
  purpose: "job_hunting" | "thinking_training" | null;
  interests: string[] | null;
  target_companies: string[] | null;
  onboarding_completed: boolean | null;
  ai_type_key: string | null; // 16タイプ診断（無料ベース）
  cohort: string | null; // クラスデモ識別用

  // ✅ ここが今回の肝：subscriptions / meta_wallet をやめて profiles に寄せる
  plan?: "free" | "pro" | null;
  meta_balance?: number | null;
};

// =========================
// メインコンポーネント
// =========================

export default function ProfilePage() {
  const router = useRouter();
  const supabase = createClientSupabase();

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [userId, setUserId] = useState<string | null>(null); // auth.users.id
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const run = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push("/auth");
          return;
        }

        setUserId(user.id);

        // ✅ profiles は auth_user_id で引く
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle<ProfileRow>();

        if (error) {
          console.error("profile load error:", error);
        }

        if (data) {
          setProfile(data);
        } else {
          // ✅ プロファイルがまだない場合は作成（auth_user_id で作る）
          const { data: inserted, error: insertError } = await supabase
            .from("profiles")
            .insert({
              id: user.id,
              auth_user_id: user.id,
              plan: "free",
              meta_balance: 0,
            })
            .select("*")
            .single<ProfileRow>();

          if (insertError) {
            console.error("profile insert error:", insertError);
          } else {
            setProfile(inserted);
          }
        }
      } catch (e) {
        console.error("Profile load error:", e);
      } finally {
        setAuthChecked(true);
      }
    };

    run();
  }, [supabase, router]);

  if (!authChecked) {
    return (
      <div className="flex justify-center items-center h-[60vh] text-sm text-slate-500">
        読み込み中...
      </div>
    );
  }

  if (!profile || !userId) {
    return (
      <div className="flex justify-center items-center h-[60vh] text-sm text-red-500">
        プロフィールの読み込みに失敗しました。
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-8 space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">プロフィール設定</h1>
        <p className="text-sm text-slate-600">
          一般面接AI・週次レポートなどで使う「前提情報」です。最初に一度埋めておけばOKです。
        </p>
      </header>

      {/* ユーザーID表示（auth.users.id） */}
      <section>
        <label className="text-xs text-slate-500 block mb-1">ユーザーID</label>
        <input
          className="border p-2 w-full text-xs rounded bg-slate-100 text-slate-500"
          value={userId}
          disabled
        />
      </section>

      {/* 無料の標準プロフィール */}
      <ProfileStandardSection profile={profile} onUpdated={setProfile} />

      {/* Deepプロフィール（ロックUI付き） */}
      <ProfileDeepSection />
    </div>
  );
}

// =========================
// 標準プロフィールセクション（無料）
// =========================

type ProfileStandardProps = {
  profile: ProfileRow;
  onUpdated: (p: ProfileRow) => void;
};

function ProfileStandardSection({ profile, onUpdated }: ProfileStandardProps) {
  const supabase = createClientSupabase();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [form, setForm] = useState({
    display_name: profile.display_name ?? "",
    affiliation: profile.affiliation ?? "",
    status: profile.status ?? "",
    purpose: profile.purpose ?? null,
    interestsText: (profile.interests ?? []).join(", "),
    targetCompaniesText: (profile.target_companies ?? []).join(", "),
  });

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    const interestsArray =
      form.interestsText.trim().length > 0
        ? form.interestsText
            .replace(/、/g, ",")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : [];

    const targetCompaniesArray =
      form.targetCompaniesText.trim().length > 0
        ? form.targetCompaniesText
            .replace(/、/g, ",")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : [];

    // ✅ 更新も auth_user_id で絞る
    const { data, error } = await supabase
      .from("profiles")
      .update({
        display_name: form.display_name || null,
        affiliation: form.affiliation || null,
        status: form.status || null,
        purpose: form.purpose,
        interests: interestsArray,
        target_companies: targetCompaniesArray,
        onboarding_completed: true,
      })
      .eq("auth_user_id", profile.auth_user_id)
      .select("*")
      .single<ProfileRow>();

    setSaving(false);

    if (error) {
      console.error("profile save error:", error);
      setMessage("保存に失敗しました…もう一度お試しください。");
      return;
    }

    onUpdated(data);
    setMessage("プロフィールを保存しました ✅");
  };

  // 16タイプ診断の簡易表示（タイプ名は診断ページで詳細表示）
  const has16Type = !!profile.ai_type_key;

  return (
    <section className="rounded-2xl border bg-white/70 p-6 space-y-4">
      <h2 className="text-xl font-semibold">基本プロフィール（無料・標準）</h2>

      <div className="space-y-3">
        {/* 名前 */}
        <div>
          <label className="text-xs text-slate-500 mb-1 block">
            名前（ニックネームでもOK）
          </label>
          <input
            className="border p-2 w-full text-sm rounded"
            value={form.display_name}
            onChange={(e) =>
              setForm((f) => ({ ...f, display_name: e.target.value }))
            }
          />
        </div>

        {/* 所属 */}
        <div>
          <label className="text-xs text-slate-500 mb-1 block">
            所属（大学・職場など）
          </label>
          <input
            className="border p-2 w-full text-sm rounded"
            placeholder="例：慶應義塾大学 経済学部 / 社会人 など"
            value={form.affiliation}
            onChange={(e) =>
              setForm((f) => ({ ...f, affiliation: e.target.value }))
            }
          />
        </div>

        {/* ステータス */}
        <div>
          <label className="text-xs text-slate-500 mb-1 block">
            現在のステータス
          </label>
          <div className="flex flex-wrap gap-2">
            {["大学生", "大学院生", "社会人", "転職検討中", "その他"].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    status: f.status === s ? "" : s,
                  }))
                }
                className={`px-3 py-1 rounded-full border text-xs ${
                  form.status === s
                    ? "bg-sky-500 text-white border-sky-500"
                    : "bg-white text-slate-700"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* 目的 */}
        <div>
          <label className="text-xs text-slate-500 mb-1 block">
            Mentor.AIで叶えたいこと
          </label>
          <div className="flex flex-wrap gap-2">
            {[
              { key: "job_hunting", label: "就活・転職対策を進めたい" },
              { key: "thinking_training", label: "思考力を鍛えたい" },
            ].map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    purpose:
                      f.purpose === p.key
                        ? null
                        : (p.key as ProfileRow["purpose"]),
                  }))
                }
                className={`px-3 py-1 rounded-full border text-xs ${
                  form.purpose === p.key
                    ? "bg-sky-500 text-white border-sky-500"
                    : "bg-white text-slate-700"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* 興味業界 */}
        <div>
          <label className="text-xs text-slate-500 mb-1 block">
            興味のある業界（カンマ or 、 区切り）
          </label>
          <input
            className="border p-2 w-full text-sm rounded"
            placeholder="例：戦略コンサル, 投資銀行, PE/VC"
            value={form.interestsText}
            onChange={(e) =>
              setForm((f) => ({ ...f, interestsText: e.target.value }))
            }
          />
        </div>

        {/* 目標企業 */}
        <div>
          <label className="text-xs text-slate-500 mb-1 block">
            目標とする企業・フィールド（カンマ or 、 区切り）
          </label>
          <input
            className="border p-2 w-full text-sm rounded"
            placeholder="例：McKinsey, 三菱商事, 外資IB, VC"
            value={form.targetCompaniesText}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                targetCompaniesText: e.target.value,
              }))
            }
          />
        </div>

        {/* 16タイプ診断の状態 */}
        <div className="mt-4 rounded-2xl bg-slate-50/80 p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-800">
                Mentor.AI 16タイプ診断
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                あなたの「AIとの付き合い方」と「思考スタイル」を16タイプにマッピングします。
              </p>
            </div>
            <a
              href="/diagnosis-16type"
              className="ml-4 inline-flex items-center rounded-full bg-sky-500 px-3 py-1 text-[11px] font-semibold text-white shadow-sm hover:bg-sky-600"
            >
              診断ページを開く →
            </a>
          </div>
          <p className="mt-2 text-[11px] text-slate-600">
            診断ステータス：{" "}
            {has16Type ? (
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                診断済み
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                まだ診断が完了していません
              </span>
            )}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            ※ 診断自体は無料で何度でも受けられます。詳細な解説・企業マッチングは Deep
            機能で拡張予定です。
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-sky-600 text-white px-4 py-2 rounded-full text-sm font-semibold hover:bg-sky-700 disabled:opacity-60"
        >
          {saving ? "保存中..." : "保存する"}
        </button>
        {message && (
          <p className="text-xs text-slate-500 whitespace-pre-line">{message}</p>
        )}
      </div>
    </section>
  );
}

// =========================
// Deepプロフィールセクション（ロックUI）
// ✅ subscriptions / meta_wallet を読まず profiles(plan, meta_balance) のみに統一
// =========================

function ProfileDeepSection() {
  const supabase = createClientSupabase();

  const [loading, setLoading] = useState(true);
  const [isPro, setIsPro] = useState(false);
  const [metaBalance, setMetaBalance] = useState(0);

  useEffect(() => {
    const run = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          setLoading(false);
          return;
        }

        const { data: pRow, error } = await supabase
          .from("profiles")
          .select("plan, meta_balance")
          .eq("auth_user_id", user.id)
          .maybeSingle();

        if (error) console.error("deep profile load error:", error);

        const plan = (pRow?.plan ?? "free") as "free" | "pro";
        setIsPro(plan === "pro");
        setMetaBalance(pRow?.meta_balance ?? 0);
      } catch (e) {
        console.error("deep profile load error:", e);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [supabase]);

  if (loading) {
    return (
      <section className="rounded-2xl border bg-white/70 p-6">
        Deepプロフィールを読み込み中...
      </section>
    );
  }

  return (
    <section className="rounded-2xl border bg-white/70 p-6 space-y-4">
      <h2 className="text-xl font-semibold">
        🔒 あなた専用 Mentor.AI（Deepプロフィール）
      </h2>
      <p className="text-sm text-slate-600">
        16タイプ診断・価値観・ストーリーカードをもとに、
        あなた専用のMentor.AIモデル「Your Model」を生成する有料機能です。
        <br />
        無料版の診断結果に加えて、より深い自己理解・志望業界／企業との詳細マッチング・
        面接／ESでの「戦い方」の設計までをサポートします。
      </p>

      <LockBox
        isPro={isPro}
        metaBalance={metaBalance}
        requiredMeta={500} // Deepプロフィール解放に必要なMeta量（仮）
        onUseMeta={() => {
          // TODO: Meta消費API（/api/meta/use → RPC consume_meta_fifo）に接続
          alert("Meta消費APIをここにつなぐ予定です。");
        }}
        onUpgradePlan={() => {
          window.location.href = "/plans";
        }}
      >
        <p className="text-xs text-slate-600">
          ※ Proプランでは Meta消費なしで常に利用できます。Metaで一時解放も可能です。
        </p>
      </LockBox>
    </section>
  );
}

// =========================
// 共通ロックコンポーネント
// =========================

type LockBoxProps = {
  isPro: boolean;
  metaBalance: number;
  requiredMeta: number;
  onUseMeta: () => void;
  onUpgradePlan: () => void;
  children: React.ReactNode;
};

function LockBox({
  isPro,
  metaBalance,
  requiredMeta,
  onUseMeta,
  onUpgradePlan,
  children,
}: LockBoxProps) {
  const hasEnoughMeta = metaBalance >= requiredMeta;

  if (isPro) {
    return (
      <div className="rounded-xl border border-emerald-300 bg-emerald-50/70 p-4 space-y-3">
        <div className="text-xs font-semibold text-emerald-700">
          Proプランで解放済み
        </div>
        {children}
      </div>
    );
  }

  if (hasEnoughMeta) {
    return (
      <div className="rounded-xl border border-amber-300 bg-amber-50/70 p-4 space-y-3">
        <div className="flex items-center justify-between text-xs text-amber-700">
          <span>Metaを使ってこの機能を一時解放できます。</span>
          <span>
            残高: {metaBalance} Meta（必要: {requiredMeta} Meta）
          </span>
        </div>

        <button
          type="button"
          onClick={onUseMeta}
          className="px-3 py-1 rounded bg-amber-500 text-white text-xs font-semibold"
        >
          Metaを使って解放する
        </button>

        <div className="pt-2 border-t border-amber-100 text-xs text-slate-600">
          Proプランなら、Meta消費なしでいつでも利用できます。
          <button
            type="button"
            onClick={onUpgradePlan}
            className="ml-2 underline"
          >
            プランを見る
          </button>
        </div>

        {children}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3 opacity-80">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
        <span>🔒 有料機能（Deepプロフィール）</span>
      </div>
      <p className="text-xs text-slate-600">
        あなた専用のMentor.AIを作る「Deepプロフィール」です。
        Proプラン、または Metaチャージで解放できます。
      </p>

      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          onClick={onUpgradePlan}
          className="px-3 py-1 rounded bg-sky-500 text-white text-xs font-semibold"
        >
          プランを見る
        </button>
        <a
          href="/meta"
          className="px-3 py-1 rounded border text-xs text-sky-600"
        >
          Metaをチャージする
        </a>
      </div>

      {children}
    </div>
  );
}
