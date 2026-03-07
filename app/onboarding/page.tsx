// app/onboarding/page.tsx
"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

type Step = 1 | 2 | 3;
type Purpose = "job_hunting" | "thinking_training";

type ProfileRow = {
  id: string;
  affiliation: string | null;
  status: string | null;
  purpose: Purpose | null;
  interests: string[] | null;
  target_companies: string[] | null;
  onboarding_completed: boolean | null;
};

type Database = any;

export default function OnboardingPage() {
  const router = useRouter();

  const supabase = useMemo(
    () =>
      createBrowserClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- フォーム状態 ---
  const [affiliation, setAffiliation] = useState("");
  const [status, setStatus] = useState("");
  const [purpose, setPurpose] = useState<Purpose | null>(null);
  const [interests, setInterests] = useState<string[]>([]);
  const [targetCompanyInput, setTargetCompanyInput] = useState("");
  const [targetCompanies, setTargetCompanies] = useState<string[]>([]);

  // 既にオンボ完了していたら / に逃がす
  useEffect(() => {
    const init = async () => {
      // getSession() はローカルストレージから読むため即時完了・ネットワーク不要。
      // loading=true の間は UI を表示しないので、session が取れてから /auth 判定する。
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        router.replace("/auth");
        return;
      }

      const { data: profile, error } = await supabase
        .from("profiles")
        .select(
          "affiliation,status,purpose,interests,target_companies,onboarding_completed"
        )
        .eq("id", session.user.id)
        .maybeSingle<ProfileRow>();

      if (error) {
        console.error("profiles load error:", error);
      }

      if (profile?.onboarding_completed) {
        router.replace("/");
        return;
      }

      if (profile) {
        setAffiliation(profile.affiliation ?? "");
        setStatus(profile.status ?? "");
        setPurpose(profile.purpose ?? null);
        setInterests(profile.interests ?? []);
        setTargetCompanies(profile.target_companies ?? []);
      }

      setLoading(false);
    };

    init();
  }, [supabase, router]);

  const handleToggleInterest = (value: string) => {
    setInterests((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

  const handleAddTargetCompany = () => {
    const trimmed = targetCompanyInput.trim();
    if (!trimmed) return;
    if (!targetCompanies.includes(trimmed)) {
      setTargetCompanies((prev) => [...prev, trimmed]);
    }
    setTargetCompanyInput("");
  };

  const handleRemoveTargetCompany = (name: string) => {
    setTargetCompanies((prev) => prev.filter((c) => c !== name));
  };

  // 👇 最終保存
  const handleSave = async () => {
    setError(null);
    setSaving(true);

    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setError("セッションが切れました。再度ログインしてください。");
      setSaving(false);
      router.replace("/auth");
      return;
    }

    const { error: upsertError } = await supabase.from("profiles").upsert(
      {
        id: auth.user.id,
        affiliation,
        status,
        purpose,
        interests, // text[]
        target_companies: targetCompanies, // text[]
        onboarding_completed: true,
      },
      { onConflict: "id" }
    );

    if (upsertError) {
      console.error(upsertError);
      setError(
        upsertError.message ||
          "保存に失敗しました。時間をおいて再度お試しください。"
      );
      setSaving(false);
      return;
    }

    setSaving(false);

    // ✅ オンボ完了 → すぐホームへ（AIタイプ診断は任意ページに切り離し）
    router.replace("/");
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="rounded-3xl bg-white/70 px-6 py-4 text-sm text-slate-600 shadow">
          プロフィールを読み込んでいます…
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-2xl rounded-3xl border border-white/40 bg-white/80 p-8 shadow-[0_18px_45px_rgba(15,23,42,0.12)] backdrop-blur-[30px]">
        {/* ステップ表示 */}
        <div className="mb-6 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <StepDot active={step >= 1}>基本情報</StepDot>
            <span className="text-slate-300">—</span>
            <StepDot active={step >= 2}>目的・興味</StepDot>
            <span className="text-slate-300">—</span>
            <StepDot active={step >= 3}>目標・フィールド</StepDot>
          </div>
          <span>Step {step} / 3</span>
        </div>

        {error && (
          <p className="mb-4 rounded-2xl bg-rose-50 px-4 py-2 text-xs text-rose-700">
            {error}
          </p>
        )}

        {/* 各ステップ */}
        {step === 1 && (
          <Step1Basic
            affiliation={affiliation}
            status={status}
            setAffiliation={setAffiliation}
            setStatus={setStatus}
          />
        )}

        {step === 2 && (
          <Step2Purpose
            purpose={purpose}
            interests={interests}
            setPurpose={setPurpose}
            toggleInterest={handleToggleInterest}
          />
        )}

        {step === 3 && (
          <Step3Targets
            targetCompanies={targetCompanies}
            targetCompanyInput={targetCompanyInput}
            setTargetCompanyInput={setTargetCompanyInput}
            addTargetCompany={handleAddTargetCompany}
            removeTargetCompany={handleRemoveTargetCompany}
          />
        )}

        {/* ボトムナビ */}
        <div className="mt-8 flex items-center justify-between">
          <button
            type="button"
            disabled={step === 1}
            onClick={() =>
              setStep((prev) => (prev > 1 ? ((prev - 1) as Step) : prev))
            }
            className="rounded-full border border-slate-200 px-4 py-1.5 text-xs text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            戻る
          </button>

          {step < 3 ? (
            <button
              type="button"
              onClick={() =>
                setStep((prev) => (prev < 3 ? ((prev + 1) as Step) : prev))
              }
              className="rounded-full bg-sky-500 px-6 py-2 text-xs font-semibold text-white shadow-sm hover:bg-sky-600"
            >
              次へ進む
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-full bg-sky-500 px-6 py-2 text-xs font-semibold text-white shadow-sm hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "保存中..." : "はじめる（ホームへ）"}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}

function StepDot({
  active,
  children,
}: {
  active: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`h-2 w-2 rounded-full ${
          active ? "bg-sky-500" : "bg-slate-200"
        }`}
      />
      <span
        className={`text-[11px] ${
          active ? "text-slate-800" : "text-slate-400"
        }`}
      >
        {children}
      </span>
    </div>
  );
}

// --- Step1: 基本情報 ---
function Step1Basic({
  affiliation,
  status,
  setAffiliation,
  setStatus,
}: {
  affiliation: string;
  status: string;
  setAffiliation: (v: string) => void;
  setStatus: (v: string) => void;
}) {
  return (
    <>
      <h1 className="mb-1 text-lg font-semibold text-slate-900">
        あなたについて教えてください
      </h1>
      <p className="mb-6 text-xs text-slate-500">
        就活生以外の方もご利用いただけます。
      </p>

      <div className="space-y-5 text-xs">
        <div>
          <label className="mb-1 block font-medium text-slate-700">
            所属（大学・職場・学校など）
          </label>
          <input
            value={affiliation}
            onChange={(e) => setAffiliation(e.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-white/80 px-3 py-2 text-xs text-slate-900 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
            placeholder="〇〇大学 〇〇学部 / 社会人 / フリーランス など"
          />
        </div>

        <div>
          <label className="mb-1 block font-medium text-slate-700">
            現在のステータス
          </label>
          <div className="flex flex-wrap gap-2">
            {["大学生", "大学院生", "社会人", "転職検討中", "その他"].map(
              (option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setStatus(option)}
                  className={`rounded-full border px-3 py-1 ${
                    status === option
                      ? "border-sky-400 bg-sky-50 text-sky-700"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {option}
                </button>
              )
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// --- Step2: 目的＆興味 ---
function Step2Purpose({
  purpose,
  interests,
  setPurpose,
  toggleInterest,
}: {
  purpose: Purpose | null;
  interests: string[];
  setPurpose: (p: Purpose) => void;
  toggleInterest: (v: string) => void;
}) {
  const interestOptions = [
    "戦略コンサル",
    "総合コンサル",
    "投資銀行（IB）",
    "マーケット／トレーディング",
    "アセットマネジメント",
    "PEファンド",
    "VC",
    "ヘッジファンド",
    "総合商社",
    "専門商社",
    "メーカー（自動車・消費財など）",
    "ITメガベンチャー",
    "スタートアップ",
    "官公庁・国際機関",
    "その他",
  ];

  return (
    <>
      <h1 className="mb-1 text-lg font-semibold text-slate-900">
        Mentor.AIで叶えたいこと
      </h1>
      <p className="mb-6 text-xs text-slate-500">
        目的に合わせて、ダッシュボードとおすすめメニューを最適化します。
      </p>

      <div className="space-y-6 text-xs">
        <div>
          <label className="mb-2 block font-medium text-slate-700">
            メインの目的
          </label>
          <div className="grid gap-3 md:grid-cols-2">
            <button
              type="button"
              onClick={() => setPurpose("job_hunting")}
              className={`rounded-2xl border p-3 text-left ${
                purpose === "job_hunting"
                  ? "border-sky-400 bg-sky-50"
                  : "border-slate-200 bg-white hover:bg-slate-50"
              }`}
            >
              <div className="text-xs font-semibold text-slate-800">
                就活・転職対策を進めたい
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                ケース・面接・ES・業界研究を一気通貫で支援します。
              </p>
            </button>

            <button
              type="button"
              onClick={() => setPurpose("thinking_training")}
              className={`rounded-2xl border p-3 text-left ${
                purpose === "thinking_training"
                  ? "border-sky-400 bg-sky-50"
                  : "border-slate-200 bg-white hover:bg-slate-50"
              }`}
            >
              <div className="text-xs font-semibold text-slate-800">
                思考力を鍛えたい（社会人・自己成長）
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                仕事や人生の判断力を、AIと一緒に磨いていきます。
              </p>
            </button>
          </div>
        </div>

        <div>
          <label className="mb-2 block font-medium text-slate-700">
            興味のある業界（複数選択可）
          </label>
          <div className="flex flex-wrap gap-2">
            {interestOptions.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => toggleInterest(opt)}
                className={`rounded-full border px-3 py-1 ${
                  interests.includes(opt)
                    ? "border-sky-400 bg-sky-50 text-sky-700"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

// --- Step3: 目標企業 ---
function Step3Targets({
  targetCompanies,
  targetCompanyInput,
  setTargetCompanyInput,
  addTargetCompany,
  removeTargetCompany,
}: {
  targetCompanies: string[];
  targetCompanyInput: string;
  setTargetCompanyInput: (v: string) => void;
  addTargetCompany: () => void;
  removeTargetCompany: (v: string) => void;
}) {
  return (
    <>
      <h1 className="mb-1 text-lg font-semibold text-slate-900">
        目標とする企業・フィールド（任意）
      </h1>
      <p className="mb-6 text-xs text-slate-500">
        設定しておくと、ダッシュボードでのおすすめやケース問題がよりあなた向けになります。
      </p>

      <div className="space-y-4 text-xs">
        <div>
          <label className="mb-1 block font-medium text-slate-700">
            目標企業・フィールド（Enterで追加）
          </label>
          <div className="flex gap-2">
            <input
              value={targetCompanyInput}
              onChange={(e) => setTargetCompanyInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  e.stopPropagation();
                  addTargetCompany();
                }
              }}
              className="flex-1 rounded-2xl border border-slate-200 bg-white/80 px-3 py-2 text-xs text-slate-900 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
              placeholder="McKinsey / 三菱商事 / 外資IB / VC / 自分の事業 など"
            />
            <button
              type="button"
              onClick={addTargetCompany}
              className="rounded-2xl bg-sky-500 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-sky-600"
            >
              追加
            </button>
          </div>
        </div>

        {targetCompanies.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {targetCompanies.map((company) => (
              <span
                key={company}
                className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-3 py-1 text-[11px] text-sky-700"
              >
                {company}
                <button
                  type="button"
                  onClick={() => removeTargetCompany(company)}
                  className="text-[10px] text-sky-500 hover:text-sky-700"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
