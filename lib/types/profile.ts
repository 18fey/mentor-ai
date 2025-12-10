// lib/types/profile.ts
export type ProfileRow = {
  id: string;
  display_name: string | null;
  affiliation: string | null;
  status: string | null; // "学生" とか自由文字列でOK
  purpose: "job_hunting" | "thinking_training" | null;
  interests: string[] | null;
  target_companies: string[] | null;
  onboarding_completed: boolean | null;
  ai_type_key: string | null;
  cohort: string | null; // クラスデモ識別用
};
