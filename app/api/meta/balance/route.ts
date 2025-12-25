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
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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

    // ✅ 残高はRPC（= meta_lots の正）に統一
    const { data, error } = await supabase.rpc("get_my_meta_balance");
    if (error) {
      console.error("get_my_meta_balance rpc error:", error);
      return NextResponse.json({ ok: false, reason: "db_error" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, balance: Number(data ?? 0) }, { status: 200 });
  } catch (e) {
    console.error("meta balance route error:", e);
    return NextResponse.json({ ok: false, reason: "server_error" }, { status: 500 });
  }
}
