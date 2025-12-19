// app/api/profile/get/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Database = any;

type ProfileRow = {
  id: string;
  auth_user_id: string;
  display_name: string | null;
  affiliation: string | null;
  job_stage: string | null;
  purpose: string | null;
  interests: string[] | null;
  target_companies: string[] | null;
  plan: "free" | "pro" | null;
  meta_balance: number | null;
  cohort: number | null;
};

async function createSupabaseFromCookies() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          cookieStore.set({ name, value: "", ...options });
        },
      },
    }
  );
}

async function requireAuthUserId() {
  const supabase = await createSupabaseFromCookies();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.id) return null;
  return data.user.id;
}

export async function GET(_req: NextRequest) {
  try {
    const authUserId = await requireAuthUserId();
    if (!authUserId) {
      return NextResponse.json(
        { ok: false, error: "user_not_authenticated", profile: null },
        { status: 401 }
      );
    }

    const supabase = await createSupabaseFromCookies();

    const { data, error } = await supabase
      .from("profiles")
      .select(
        "id, auth_user_id, display_name, affiliation, job_stage, purpose, interests, target_companies, plan, meta_balance, cohort"
      )
      .eq("auth_user_id", authUserId)
      .maybeSingle<ProfileRow>();

    if (error) {
      console.error("[profile/get] error:", error);
      return NextResponse.json({ ok: false, error: "profile_get_failed", profile: null }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ ok: true, profile: null, isNewUser: true });
    }

    return NextResponse.json({
      ok: true,
      isNewUser: false,
      profile: {
        id: data.id,
        authUserId: data.auth_user_id,
        displayName: data.display_name ?? "",
        affiliation: data.affiliation ?? "",
        jobStage: data.job_stage ?? "",
        purpose: data.purpose ?? "",
        interests: data.interests ?? [],
        targetCompanies: data.target_companies ?? [],
        plan: data.plan ?? "free",
        metaBalance: data.meta_balance ?? 0,
        cohort: data.cohort ?? 0,
      },
    });
  } catch (e) {
    console.error("[profile/get] exception:", e);
    return NextResponse.json({ ok: false, error: "profile_get_failed", profile: null }, { status: 500 });
  }
}
