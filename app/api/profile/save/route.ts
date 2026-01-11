// app/api/profile/save/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { appMode } from "@/lib/featureFlags";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Database = any;

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

export async function POST(req: NextRequest) {
  try {
    const authUserId = await requireAuthUserId();
    if (!authUserId) {
      return NextResponse.json(
        { ok: false, error: "not_authenticated" },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({} as any));
    const supabase = await createSupabaseFromCookies();

    // ✅ id を必ず入れる（profiles.id = auth.users.id を保証）
    const rowToUpsert = {
      id: authUserId,
      auth_user_id: authUserId, // 列があるなら埋める（null事故防止）
      display_name: body.displayName ?? null,
      affiliation: body.affiliation ?? null,
      job_stage: body.jobStage ?? null,
      purpose: body.purpose ?? null,
      interests: Array.isArray(body.interests) ? body.interests : [],
      target_companies: Array.isArray(body.targetCompanies) ? body.targetCompanies : [],
      ...(appMode === "classroom" ? { cohort: 2025 } : {}),
    };

    const { error } = await supabase
      .from("profiles")
      .upsert(rowToUpsert, { onConflict: "id" });

    if (error) {
      console.error("[profile/save] upsert error:", error);
      return NextResponse.json(
        { ok: false, error: "profile_save_failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[profile/save] exception:", e);
    return NextResponse.json(
      { ok: false, error: "profile_save_failed" },
      { status: 500 }
    );
  }
}
