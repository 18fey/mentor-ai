// app/api/story-cards/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

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

export async function GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseFromCookies();

    const { data: auth, error: authErr } = await supabase.auth.getUser();
    const user = auth?.user ?? null;

    if (authErr || !user?.id) {
      return NextResponse.json(
        { ok: false, error: "unauthorized", message: "ログインが必要です。" },
        { status: 401 }
      );
    }

    const authUserId = user.id;

    // ✅ profiles を auth_user_id で引く（あなたの設計）
    const { data: profile, error: profErr } = await supabase
      .from("profiles")
      .select("id")
      .eq("auth_user_id", authUserId)
      .maybeSingle();

    if (profErr) {
      console.error("profiles select error:", profErr);
      return NextResponse.json(
        { ok: false, error: "profile_fetch_failed" },
        { status: 500 }
      );
    }

    if (!profile?.id) {
      // 作れてないなら、UI側で profile 作る導線が必要
      return NextResponse.json(
        { ok: true, storyCards: [], message: "profile が未作成です。" },
        { status: 200 }
      );
    }

    const profileId = profile.id;

    // ✅ story_cards.user_id は「profile.id」が入ってる前提で取得
    const { data, error } = await supabase
      .from("story_cards")
      .select("*")
      .eq("user_id", profileId)
      .order("last_updated_at", { ascending: false });

    if (error) {
      console.error("story_cards select error:", error);
      return NextResponse.json(
        { ok: false, error: "story_cards_fetch_failed", detail: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, storyCards: data ?? [] });
  } catch (e: any) {
    console.error("GET /api/story-cards server_error:", e);
    return NextResponse.json(
      { ok: false, error: "server_error", message: "取得中にエラーが発生しました。" },
      { status: 500 }
    );
  }
}
