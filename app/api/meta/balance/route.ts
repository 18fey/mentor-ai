// app/api/meta/balance/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Database = any;

async function createSupabaseFromCookies() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, // ✅ anon のまま
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );
}

export async function GET() {
  try {
    const supabase = await createSupabaseFromCookies();

    // ✅ 認証（RLS前提）
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth?.user?.id) {
      return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
    }

    const authUserId = auth.user.id;
    const nowIso = new Date().toISOString();

    // ✅ meta_lots の remaining を合算（期限内だけ）
    const { data: lots, error: lotsErr } = await supabase
      .from("meta_lots")
      .select("remaining")
      .eq("auth_user_id", authUserId)
      .gt("expires_at", nowIso)
      .gt("remaining", 0);

    if (lotsErr) {
      console.error("meta balance: meta_lots select error:", lotsErr);
      return NextResponse.json({ ok: false, reason: "db_error" }, { status: 500 });
    }

    const balance = (lots ?? []).reduce((sum, row: any) => sum + (Number(row.remaining) || 0), 0);

    return NextResponse.json({ ok: true, balance }, { status: 200 });
  } catch (e) {
    console.error("meta balance route error:", e);
    return NextResponse.json({ ok: false, reason: "server_error" }, { status: 500 });
  }
}
