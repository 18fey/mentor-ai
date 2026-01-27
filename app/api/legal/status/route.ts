// app/api/legal/status/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";

type Database = any;

export async function GET() {
  const cookieStore = await cookies();

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        // GETなのでここでは触らない（読み取り専用）
        set() {},
        remove() {},
      },
    }
  );

  const { data: auth, error: authErr } = await supabase.auth.getUser();
  const user = auth?.user ?? null;

  if (authErr || !user?.id) {
    return NextResponse.json({ ok: true, loggedIn: false, legalOk: false });
  }

  const { data: profile, error: profErr } = await supabase
    .from("profiles")
    .select("agreed_terms,agreed_terms_at,is_adult,is_adult_at,terms_version")
    .eq("id", user.id)
    .maybeSingle();

  // ✅ あなたの「5カラム」前提で判定（同意/年齢 + それぞれのat + version）
  const legalOk =
    !profErr &&
    profile?.agreed_terms === true &&
    profile?.is_adult === true &&
    !!profile?.agreed_terms_at &&
    !!profile?.is_adult_at &&
    !!profile?.terms_version;

  return NextResponse.json({
    ok: true,
    loggedIn: true,
    legalOk,
    // デバッグ用に最低限だけ返す（不要なら消してOK）
    terms_version: profile?.terms_version ?? null,
  });
}
