// app/api/me/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

type Database = any;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function createSupabaseFromCookies() {
  const cookieStore = cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        async get(name: string) {
          return (await cookieStore).get(name)?.value;
        },
      },
    }
  );
}

type Plan = "free" | "pro";

export async function GET() {
  try {
    const supabase = createSupabaseFromCookies();
    const { data, error } = await supabase.auth.getUser();

    if (error || !data?.user?.id) {
      return NextResponse.json({ ok: false, user: null }, { status: 200 });
    }

    const authUserId = data.user.id;

    const { data: profile, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select("plan, meta_balance")
      .eq("auth_user_id", authUserId)
      .maybeSingle();

    if (pErr) {
      console.error("me profile error:", pErr);
    }

    const rawPlan = (profile?.plan ?? "free") as any;
    const plan: Plan = rawPlan === "pro" || rawPlan === "beta" ? "pro" : "free";

    return NextResponse.json({
      ok: true,
      user: {
        email: data.user.email ?? null,
        plan,
        meta_balance: profile?.meta_balance ?? 0,
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
