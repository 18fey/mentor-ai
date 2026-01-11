// app/profile/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
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
  id: string; // profiles のPK（= auth.users.id に統一）
  auth_user_id: string | null; // 互換用（常に user.id に矯正する）
  display_name: string | null;
  affiliation: string | null;
  status: string | null; // 学生 / 社会人 など
  purpose: "job_hunting" | "thinking_training" | null;
  interests: string[] | null;
  target_companies: string[] | null;
  onboarding_completed: boolean | null;
  ai_type_key: string | null; // 16タイプ診断（無料ベース）
  cohort: string | null; // クラスデモ識別用

  plan?: "free" | "pro" | "elite" | null;

  // ❌ meta_balance は使わない（source of truth が meta_lots/RPC）
  // meta_balance?: number | null;
};

// =========================
// メインコンポーネント
// =========================

export default function ProfilePage() {
  const router = useRouter();

  // ✅ 毎レンダーでclientを作り直さない
  const supabase = useMemo(() => createClientSupabase(), []);

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

        // ✅ profiles は id = user.id で引く（唯一の正）
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle<ProfileRow>();

        if (error) {
          console.error("profile load error:", error);
        }

        if (data) {
          // ✅ 念のため矯正（過去のnull事故を治す）
          if (data.auth_user_id !== user.id) {
            const { data: fixed, error: fixErr } = await supabase
              .from("profiles")
              .update({ auth_user_id: user.id })
              .eq("id", user.id)
              .select("*")
              .single<ProfileRow>();

            if (fixErr) console.error("profile auth_user_id fix error:", fixErr);
            else setProfile(fixed);
          } else {
            setProfile(data);
          }
        } else {
          // ✅ 無ければ作る：insertよりupsert（競合に強い）
          const { data: upserted, error: upsertError } = await supabase
            .from("profiles")
            .upsert(
              {
                id: user.id,
                auth_user_id: user.id, // null事故防止
                plan: "free",
              },
              { onConflict: "id" }
            )
            .select("*")
            .single<ProfileRow>();

          if (upsertError) {
            console.error("profile upsert error:", upsertError);
          } else {
            setProfile(upserted);
          }
        }
      } catch (e) {
        console.error("Profile load error:", e);
      } finally {
        setAuthChecked(true);
      }
    };

    void run();
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
  const supabase = useMemo(() => createClientSupabase(), []);
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

    // ✅ 更新は id で絞る（唯一の正）
    // ✅ ついでに auth_user_id を矯正しておく（null事故の治癒）
    const { data, error } = await supabase
      .from("profiles")
      .update({
        auth_user_id: profile.id,
        display_name: form.display_name || null,
        affiliation: form.affiliation || null,
        status: form.status || null,
        purpose: form.purpose,
        interests: interestsArray,
        target_companies: targetCompaniesArray,
        onboarding_completed: true,
      })
      .eq("id", profile.id)
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
            onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
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
            onChange={(e) => setForm((f) => ({ ...f, affiliation: e.target.value }))}
          />
        </div>

        {/* ステータス */}
        <div>
          <label className="text-xs text-slate-500 mb-1 block">現在のステータス</label>
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
                      f.purpose === p.key ? null : (p.key as ProfileRow["purpose"]),
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
            onChange={(e) => setForm((f) => ({ ...f, interestsText: e.target.value }))}
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
              <p className="text-xs font-semibold text-slate-800">Mentor.AI 16タイプ診断</p>
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
        {message && <p className="text-xs text-slate-500 whitespace-pre-line">{message}</p>}
      </div>
    </section>
  );
}
