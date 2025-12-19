// app/api/profile/ensure/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { appMode } from "@/lib/featureFlags";

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

export async function POST(_req: NextRequest) {
  try {
    const authUserId = await requireAuthUserId();
    if (!authUserId) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const supabase = await createSupabaseFromCookies();

    // 1) 既存チェック
    const { data: existing, error: selErr } = await supabase
      .from("profiles")
      .select(
        "id, auth_user_id, display_name, affiliation, job_stage, purpose, interests, target_companies, plan, meta_balance, cohort"
      )
      .eq("auth_user_id", authUserId)
      .maybeSingle<ProfileRow>();

    if (selErr) {
      console.error("[profile/ensure] select error:", selErr);
      return NextResponse.json({ ok: false, error: "profile_select_failed" }, { status: 500 });
    }

    if (existing) {
      return NextResponse.json({ ok: true, created: false, profileId: existing.id });
    }

    // 2) 無ければ作る（RLS: auth_user_id = auth.uid() を満たす）
    const cohort =
      appMode === "classroom" ? 2024 /* 例：intで持つ前提 */ : 0;

    const { data: created, error: insErr } = await supabase
      .from("profiles")
      .insert({
        auth_user_id: authUserId,
        display_name: null,
        affiliation: null,
        job_stage: null,
        purpose: null,
        interests: [],
        target_companies: [],
        plan: "free",
        meta_balance: 0,
        cohort,
      })
      .select("id")
      .single();

    if (insErr) {
      console.error("[profile/ensure] insert error:", insErr);
      return NextResponse.json({ ok: false, error: "profile_insert_failed" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, created: true, profileId: created.id });
  } catch (e) {
    console.error("[profile/ensure] exception:", e);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
