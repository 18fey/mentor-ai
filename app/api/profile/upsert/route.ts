// app/api/profile/upsert/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { supabaseServer } from "@/lib/supabase-server";
import { appMode } from "@/lib/featureFlags";

type Database = any;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

export async function POST(req: NextRequest) {
  try {
    const supabase = createSupabaseFromCookies();
    const { data: auth, error: authErr } = await (await supabase).auth.getUser();
    const userId = auth?.user?.id ?? null;

    if (authErr || !userId) {
      return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({} as any))) as {
      displayName?: string;
      affiliation?: string;
      jobStage?: string;
      purpose?: string;
      interests?: string[];
      targetCompanies?: string[];
    };

    const payload = {
      id: userId, // ✅ profiles.id = auth.users.id に統一
      display_name: body.displayName ?? null,
      affiliation: body.affiliation ?? null,
      job_stage: body.jobStage ?? null,
      purpose: body.purpose ?? null,
      interests: Array.isArray(body.interests) ? body.interests : [],
      target_companies: Array.isArray(body.targetCompanies) ? body.targetCompanies : [],
      ...(appMode === "classroom" ? { cohort: 2025 } : {}),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseServer
      .from("profiles")
      .upsert(payload, { onConflict: "id" })
      .select("*")
      .single();

    if (error) {
      console.error("[profile/upsert] upsert error:", error);
      return NextResponse.json({ ok: false, error: "profile_upsert_failed" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, profile: data }, { status: 200 });
  } catch (e: any) {
    console.error("[profile/upsert] exception:", e);
    return NextResponse.json({ ok: false, error: "server_error", message: e?.message }, { status: 500 });
  }
}
