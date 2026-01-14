// app/api/generation-jobs/status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type FeatureId = "industry_insight" |"es_correction"
  | "fermi"
  | "case_generate"
  | "fermi_generate"
  | "interview_10"
  | "industry_insight"
  | "case_interview"
  | "enterprise_qgen"
  | "career_gap_deep"
  | "ai_training"
  | "es_draft";; // まずはこれだけでOK（後でunion拡張）

async function createSupabaseFromCookies() {
  const cookieStore = await cookies();
  return createServerClient(
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

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseFromCookies();

  const { data: auth, error: authErr } = await supabase.auth.getUser();
  const user = auth?.user ?? null;
  if (authErr || !user?.id) {
    return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
  }

  const url = new URL(req.url);
  const feature = (url.searchParams.get("feature") ?? "") as FeatureId;
  const key = url.searchParams.get("key") ?? "";

  if (!feature || !key) {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  const { data: job, error } = await supabase
    .from("generation_jobs")
    .select("id, status, result, error_code, error_message, updated_at, created_at")
    .eq("auth_user_id", user.id)
    .eq("feature_id", feature)
    .eq("idempotency_key", key)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: "db_error" }, { status: 500 });
  }
  if (!job) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, job });
}
