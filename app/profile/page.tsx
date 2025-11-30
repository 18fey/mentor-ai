// app/profile/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

type Database = any;

export default function ProfilePage() {
  const router = useRouter();
  const supabase = createClientComponentClient<Database>();

  const [userId, setUserId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

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

        // 既存プロフィールがあれば取得
        const res = await fetch(`/api/profile/get?userId=${user.id}`);
        const data = await res.json();

        if (data.profile) {
          setForm({
            name: data.profile.name || "",
            university: data.profile.university || "",
            faculty: data.profile.faculty || "",
            grade: data.profile.grade || "",
            interestedIndustries:
              (data.profile.interested_industries || []).join(", "),
            valuesTags: (data.profile.values_tags || []).join(", "),
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

    await fetch("/api/profile/save", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: userId, // ✅ ログインユーザーIDで固定
        name: form.name,
        university: form.university,
        faculty: form.faculty,
        grade: form.grade,
        interestedIndustries: form.interestedIndustries
          ? form.interestedIndustries
              .replace(/、/g, ",")
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : [],
        valuesTags: form.valuesTags
          ? form.valuesTags
              .replace(/、/g, ",")
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : [],
      }),
    });

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

      {/* データ利用に関する注意書き */}
      <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3 text-[11px] text-slate-700 space-y-1">
        <p className="font-semibold text-slate-800 text-xs">
          プロフィール入力について（安心して使うために）
        </p>
        <ul className="list-disc pl-4 space-y-1">
          <li>
            本名でなく<strong>ニックネーム</strong>で登録しても問題ありません。
          </li>
          <li>
            <strong>住所・電話番号・マイナンバー</strong>
            などの連絡先情報は入力しないでください。
          </li>
          <li>
            入力された内容は、
            <strong>就活サポート・自己分析のためのフィードバック</strong>
            にのみ利用されます。
          </li>
        </ul>
        <p className="text-[10px] text-slate-500 mt-1">
          ※ 健康状態・宗教・政治などのセンシティブな内容は、書く場合によく考えてから入力してください。
        </p>
      </div>

      {/* USER ID 表示（編集不可） */}
      <div>
        <label className="text-xs text-slate-500">ユーザーID</label>
        <input
          className="border p-2 w-full text-sm rounded bg-slate-100 text-slate-500"
          value={userId ?? ""}
          disabled
        />
      </div>

      <div className="pt-2 space-y-3">
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

        <div>
          <label className="text-xs text-slate-500">学部</label>
          <input
            className="border p-2 w-full text-sm rounded"
            value={form.faculty}
            onChange={(e) => setForm({ ...form, faculty: e.target.value })}
          />
        </div>

        <div>
          <label className="text-xs text-slate-500">学年</label>
          <input
            className="border p-2 w-full text-sm rounded"
            value={form.grade}
            onChange={(e) => setForm({ ...form, grade: e.target.value })}
          />
        </div>

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
        className="mt-2 bg-sky-600 text-white px-4 py-2 rounded-full text-sm font-semibold hover:bg-sky-700"
      >
        保存する
      </button>
    </div>
  );
}
