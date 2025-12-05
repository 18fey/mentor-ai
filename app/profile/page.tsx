// app/profile/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

type ProfileRow = {
  id: string;
  display_name: string | null;
  affiliation: string | null;
  university: string | null;
  faculty: string | null;
  grade: string | null;
  status: string | null;
  interests: string[] | null;
  values_tags: string[] | null;
};

export default function ProfilePage() {
  const router = useRouter();
  const supabase = createClientComponentClient();

  const [userId, setUserId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: "",
    university: "",
    faculty: "",
    grade: "",
    interestedIndustries: "",
    valuesTags: "",
  });

  // ✅ ログインユーザー取得 & 既存プロフィールロード
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

        const { data: profile, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle<ProfileRow>();

        if (error) {
          console.error("profile load error:", error);
        }

        if (profile) {
          setForm({
            name: profile.display_name ?? "",
            university: profile.university ?? "",
            faculty: profile.faculty ?? "",
            grade: profile.grade ?? "",
            interestedIndustries: (profile.interests ?? []).join(", "),
            valuesTags: (profile.values_tags ?? []).join(", "),
          });
        }
      } catch (e) {
        console.error("Profile load error:", e);
      } finally {
        setAuthChecked(true);
      }
    };

    run();
  }, [supabase, router]);

  async function save() {
    if (!userId) {
      router.push("/auth");
      return;
    }

    setSaving(true);

    const interestsArray =
      form.interestedIndustries.trim().length > 0
        ? form.interestedIndustries
            .replace(/、/g, ",")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : [];

    const valuesTagsArray =
      form.valuesTags.trim().length > 0
        ? form.valuesTags
            .replace(/、/g, ",")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : [];

    const { error } = await supabase.from("profiles").upsert(
      {
        id: userId,
        display_name: form.name,
        university: form.university,
        faculty: form.faculty,
        grade: form.grade,
        interests: interestsArray, // オンボードと共通
        values_tags: valuesTagsArray,
        affiliation:
          form.university || form.faculty
            ? `${form.university} ${form.faculty}`.trim()
            : null,
      },
      { onConflict: "id" }
    );

    setSaving(false);

    if (error) {
      console.error("profile save error:", error);
      alert("保存に失敗しました…もう一度お試しください。");
      return;
    }

    alert("プロフィールを保存しました ✅");
  }

  if (!authChecked) {
    return (
      <div className="flex justify-center items-center h-[60vh] text-sm text-slate-500">
        読み込み中...
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto p-8 space-y-4">
      <h1 className="text-2xl font-bold mb-2">プロフィール設定</h1>
      <p className="text-sm text-slate-600">
        一般面接AI・週次レポートで使う「前提情報」です。最初に一度だけ埋めればOK。
      </p>

      {/* USER ID */}
      <div>
        <label className="text-xs text-slate-500">ユーザーID</label>
        <input
          className="border p-2 w-full text-sm rounded bg-slate-100 text-slate-500"
          value={userId ?? ""}
          disabled
        />
      </div>

      <div className="pt-2 space-y-3">
        {/* 名前 */}
        <div>
          <label className="text-xs text-slate-500">
            名前（ニックネームでもOK）
          </label>
          <input
            className="border p-2 w-full text-sm rounded"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>

        {/* 大学 */}
        <div>
          <label className="text-xs text-slate-500">大学</label>
          <input
            className="border p-2 w-full text-sm rounded"
            value={form.university}
            onChange={(e) =>
              setForm({ ...form, university: e.target.value })
            }
          />
        </div>

        {/* 学部 */}
        <div>
          <label className="text-xs text-slate-500">学部</label>
          <input
            className="border p-2 w-full text-sm rounded"
            value={form.faculty}
            onChange={(e) =>
              setForm({ ...form, faculty: e.target.value })
            }
          />
        </div>

        {/* 学年 */}
        <div>
          <label className="text-xs text-slate-500">学年</label>
          <input
            className="border p-2 w-full text-sm rounded"
            value={form.grade}
            onChange={(e) => setForm({ ...form, grade: e.target.value })}
          />
        </div>

        {/* 興味業界 */}
        <div>
          <label className="text-xs text-slate-500">
            興味業界（カンマ or 、区切り）
          </label>
          <input
            className="border p-2 w-full text-sm rounded"
            placeholder="例：IB, コンサル, 商社"
            value={form.interestedIndustries}
            onChange={(e) =>
              setForm({ ...form, interestedIndustries: e.target.value })
            }
          />
        </div>

        {/* 価値観タグ */}
        <div>
          <label className="text-xs text-slate-500">
            価値観タグ（カンマ or 、区切り）
          </label>
          <input
            className="border p-2 w-full text-sm rounded"
            placeholder="例：挑戦, グローバル, オーナーシップ"
            value={form.valuesTags}
            onChange={(e) =>
              setForm({ ...form, valuesTags: e.target.value })
            }
          />
        </div>
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="mt-2 bg-sky-600 text-white px-4 py-2 rounded-full text-sm font-semibold hover:bg-sky-700 disabled:opacity-60"
      >
        {saving ? "保存中..." : "保存する"}
      </button>
    </div>
  );
}
