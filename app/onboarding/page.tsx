// app/onboarding/page.tsx
"use client";

import { useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

type Step = 1 | 2 | 3;
type Purpose = "job_hunting" | "thinking_training";

export default function OnboardingPage() {
  const supabase = createClientComponentClient();
  const router = useRouter();

  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- フォーム状態 ---
  const [affiliation, setAffiliation] = useState("");
  const [status, setStatus] = useState("");
  const [purpose, setPurpose] = useState<Purpose | null>(null);
  const [interests, setInterests] = useState<string[]>([]);
  const [jobStage, setJobStage] = useState("");
  const [workIndustry, setWorkIndustry] = useState("");
  const [workRole, setWorkRole] = useState("");
  const [targetCompanyInput, setTargetCompanyInput] = useState("");
  const [targetCompanies, setTargetCompanies] = useState<string[]>([]);

  // 既にオンボ完了していたら / に逃がす
  useEffect(() => {
    const init = async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        router.push("/auth");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", auth.user.id)
        .maybeSingle();

      if (profile?.onboarding_completed) {
        router.push("/");
        return;
      }

      if (profile) {
        setAffiliation(profile.affiliation || "");
        setStatus(profile.status || "");
        setPurpose((profile.purpose as Purpose | null) ?? null);
        setInterests(profile.interests || []);
        setJobStage(profile.job_stage || "");
        setWorkIndustry(profile.work_industry || "");
        setWorkRole(profile.work_role || "");
        setTargetCompanies(profile.target_companies || []);
      }

      setLoading(false);
    };

    init();
  }, [supabase, router]);

  const handleToggleInterest = (value: string) => {
    setInterests((prev) =>
      prev.includes(value)
        ? prev.filter((v) => v !== value)
        : [...prev, value]
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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setError("セッションが切れました。再度ログインしてください。");
      setSaving(false);
      router.push("/auth");
      return;
    }

    const { error: upsertError } = await supabase.from("profiles").upsert(
      {
        id: auth.user.id,
        affiliation,
        status,
        purpose,
        interests,
        job_stage: jobStage,
        work_industry: workIndustry,
        work_role: workRole,
        target_companies: targetCompanies,
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

    // ✅ プロフィール完了後は AIタイプ診断のオンボーディングへ
    // ここを "/onboarding/ai-typing" → そこに Intro / 質問 / 結果を置くイメージ
    router.push("/onboarding/ai-typing");
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
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-2xl rounded-3xl border border-white/40 bg-white/80 p-8 shadow-[0_18px_45px_rgba(15,23,42,0.12)] backdrop-blur-[30px]"
      >
        {/* ステップ表示 */}
        <div className="mb-6 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <StepDot active={step >= 1}>基本情報</StepDot>
            <span className="text-slate-300">—</span>
            <StepDot active={step >= 2}>目的</StepDot>
            <span className="text-slate-300">—</span>
            <StepDot active={step >= 3}>戦略の粒度</StepDot>
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
            jobStage={jobStage}
            workIndustry={workIndustry}
            workRole={workRole}
            setPurpose={setPurpose}
            setJobStage={setJobStage}
            setWorkIndustry={setWorkIndustry}
            setWorkRole={setWorkRole}
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
              type="submit"
              disabled={saving}
              className="rounded-full bg-sky-500 px-6 py-2 text-xs font-semibold text-white shadow-sm hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "保存中..." : "AIタイプ診断へ進む"}
            </button>
          )}
        </div>
      </form>
    </main>
  );
}

function StepDot({
  active,
  children,
}: {
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`h-2 w-2 rounded-full ${
          active ? "bg-sky-500" : "bg-slate-200"
        }`}
      />
      <span className={`text-[11px] ${active ? "text-slate-800" : "text-slate-400"}`}>
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
      <p className="mb-6 text-xs text-slate-500">就活生以外の方もご利用いただけます。</p>

      <div className="space-y-5 text-xs">
        <div>
          <label className="mb-1 block font-medium text-slate-700">
            所属（大学・職場・学校など）
          </label>
          <input
            value={affiliation}
            onChange={(e) => setAffiliation(e.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-white/80 px-3 py-2 text-xs text-slate-900 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
            placeholder="慶應義塾大学 経済学部 / 社会人 / フリーランス など"
          />
        </div>

        <div>
          <label className="mb-1 block font-medium text-slate-700">
            現在のステータス
          </label>
          <div className="flex flex-wrap gap-2">
            {["大学生", "大学院生", "社会人", "転職検討中", "その他"].map((option) => (
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
            ))}
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
  jobStage,
  workIndustry,
  workRole,
  setPurpose,
  setJobStage,
  setWorkIndustry,
  setWorkRole,
  toggleInterest,
}: {
  purpose: Purpose | null;
  interests: string[];
  jobStage: string;
  workIndustry: string;
  workRole: string;
  setPurpose: (p: Purpose) => void;
  setJobStage: (v: string) => void;
  setWorkIndustry: (v: string) => void;
  setWorkRole: (v: string) => void;
  toggleInterest: (v: string) => void;
}) {
  const interestOptions = [
    "戦略コンサル",
    "投資銀行（IB）",
    "PE/VC",
    "マーケッツ/トレーディング",
    "ITメガベンチャー",
    "総合商社",
    "メーカー",
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

        {purpose === "job_hunting" && (
          <div>
            <label className="mb-2 block font-medium text-slate-700">
              就活状況
            </label>
            <div className="grid gap-2 md:grid-cols-2">
              {[
                "これから本格的に始める",
                "インターン選考中",
                "本選考のES・面接対策中",
                "内定済み（横移動を検討中）",
              ].map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setJobStage(opt)}
                  className={`rounded-2xl border px-3 py-2 text-left ${
                    jobStage === opt
                      ? "border-sky-400 bg-sky-50"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                >
                  <span className="text-[11px] text-slate-700">{opt}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {purpose === "thinking_training" && (
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block font-medium text-slate-700">
                現在の業界
              </label>
              <input
                value={workIndustry}
                onChange={(e) => setWorkIndustry(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white/80 px-3 py-2 text-xs text-slate-900 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
                placeholder="IT / 金融 / コンサル / メーカー など"
              />
            </div>
            <div>
              <label className="mb-1 block font-medium text-slate-700">
                現在の立場
              </label>
              <input
                value={workRole}
                onChange={(e) => setWorkRole(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white/80 px-3 py-2 text-xs text-slate-900 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
                placeholder="新人〜若手 / 中堅 / マネージャー / 経営層 など"
              />
            </div>
          </div>
        )}
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
