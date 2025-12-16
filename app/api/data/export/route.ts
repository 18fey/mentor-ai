// app/api/data/export/route.ts
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

export async function GET(_req: NextRequest) {
  try {
    const supabase = await createSupabaseFromCookies();
    const { data: auth, error: authErr } = await supabase.auth.getUser();
    const user = auth?.user ?? null;

    if (authErr || !user?.id) {
      return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
    }

    const authUserId = user.id;

    // ✅ profiles は Service Role で読む（RLS影響を避ける）
    // まず auth_user_id を優先、無ければ id でフォールバック
    const { data: profileByAuth } = await supabaseServer
      .from("profiles")
      .select("*")
      .eq("auth_user_id", authUserId)
      .maybeSingle();

    const profile =
      profileByAuth ??
      (await supabaseServer.from("profiles").select("*").eq("id", authUserId).maybeSingle()).data ??
      null;

    const { data: interviewSessions } = await supabaseServer
      .from("interview_sessions")
      .select("*")
      .eq("user_id", authUserId);

    const { data: storyCards } = await supabaseServer
      .from("story_cards")
      .select("*")
      .eq("user_id", authUserId);

    const payload = {
      exported_at: new Date().toISOString(),
      user: { id: user.id, email: user.email },
      profile,
      interviewSessions: interviewSessions ?? [],
      storyCards: storyCards ?? [],
    };

    return NextResponse.json({ ok: true, ...payload }, { status: 200 });
  } catch (e) {
    console.error("[data/export] exception:", e);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
