// app/api/profile/save/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { supabaseServer } from "@/lib/supabase-server";
import { appMode } from "@/lib/featureFlags";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Database = any;

// DB 行のざっくり型（完全じゃなくてOK）
type UserProfileRow = {
  id: string;
  auth_user_id: string | null;
  name: string | null;
  university: string | null;
  faculty: string | null;
  grade: string | null;
  interested_industries: string[] | null;
  values_tags: string[] | null;
  plan: string | null;
  beta_user: boolean | null;
  cohort: string | null;
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
  const { data: auth, error: authErr } = await supabase.auth.getUser();
  const user = auth?.user ?? null;

  if (authErr || !user?.id) return null;
  return user.id;
}

/**
 * GET: プロフィール取得（✅ query userId 廃止。セッションから）
 */
export async function GET(_req: NextRequest) {
  try {
    const authUserId = await requireAuthUserId();

    if (!authUserId) {
      return NextResponse.json(
        { error: "not_authenticated", profile: null },
        { status: 401 }
      );
    }

    const { data, error } = await supabaseServer
      .from("profiles")
      .select("*")
      .eq("auth_user_id", authUserId)
      .limit(1)
      .maybeSingle<UserProfileRow>();

    if (error) {
      console.error("[profile/save] GET error:", error);
      return NextResponse.json({ error: "profile_get_failed" }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ profile: null });
    }

    return NextResponse.json({
      profile: {
        id: data.id,
        authUserId: data.auth_user_id,
        name: data.name ?? "",
        university: data.university ?? "",
        faculty: data.faculty ?? "",
        grade: data.grade ?? "",
        interestedIndustries: data.interested_industries ?? [],
        valuesTags: data.values_tags ?? [],
        plan: data.plan ?? "free",
        betaUser: data.beta_user ?? false,
        cohort: data.cohort ?? null,
      },
    });
  } catch (e) {
    console.error("[profile/save] GET exception:", e);
    return NextResponse.json({ error: "profile_get_failed" }, { status: 500 });
  }
}

/**
 * POST: プロフィール保存（✅ body の userId/authUserId 廃止。セッションから）
 */
export async function POST(req: NextRequest) {
  try {
    const authUserId = await requireAuthUserId();

    if (!authUserId) {
      return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({} as any));

    const rowToUpsert: any = {
      auth_user_id: authUserId,
      name: body.name ?? null,
      university: body.university ?? null,
      faculty: body.faculty ?? null,
      grade: body.grade ?? null,
      interested_industries: body.interestedIndustries ?? [],
      values_tags: body.valuesTags ?? [],
    };

    // 🧠 授業モードから保存されたユーザーには cohort を付与
    if (appMode === "classroom") {
      rowToUpsert.cohort = "keio_fujita_2024_fujita_seminar";
    }

    const { error } = await supabaseServer
      .from("profiles")
      .upsert(rowToUpsert, { onConflict: "auth_user_id" });

    if (error) {
      console.error("[profile/save] POST error:", error);
      return NextResponse.json({ error: "profile_save_failed" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[profile/save] POST exception:", e);
    return NextResponse.json({ error: "profile_save_failed" }, { status: 500 });
  }
}
