// app/api/accept-terms/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { supabaseServer } from "@/lib/supabase-server";

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

export async function POST(_req: NextRequest) {
  try {
    // ✅ userId を body から受け取らない。セッションから確定
    const supabase = await createSupabaseFromCookies();
    const { data: auth, error: authErr } = await supabase.auth.getUser();
    const user = auth?.user ?? null;

    if (authErr || !user?.id) {
      return NextResponse.json(
        { ok: false, error: "not_authenticated" },
        { status: 401 }
      );
    }

    const authUserId = user.id;

    // ✅ profiles は auth_user_id で特定（偽装不可）
    const { error } = await supabaseServer
      .from("profiles")
      .update({
        accepted_terms: true,
        accepted_terms_at: new Date().toISOString(),
      })
      .eq("auth_user_id", authUserId);

    if (error) {
      console.error("[accept-terms] Supabase update error:", error);
      return NextResponse.json(
        { ok: false, error: "supabase_update_failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[accept-terms] exception:", e);
    return NextResponse.json(
      { ok: false, error: "accept_terms_failed" },
      { status: 500 }
    );
  }
}
