// app/api/feedback/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { supabaseServer } from "@/lib/supabase-server";

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

export async function POST(req: Request) {
  try {
    const data = await req.json().catch(() => ({}));

    // ログインしてれば user_id を入れる（未ログインなら null）
    const supabase = await createSupabaseFromCookies();
    const { data: auth } = await supabase.auth.getUser();
    const authUserId = auth?.user?.id ?? null;

    const { data: inserted, error } = await supabaseServer
      .from("beta_feedback")
      .insert({
        rating: data.rating ?? null,
        comment: data.comment ?? null,
        email: data.email ?? null,
        page: data.page ?? null,
        user_id: authUserId,
        // created_at はDBの default now() に任せる
      })
      .select("id")
      .single();

    if (error || !inserted) {
      console.error("[feedback] insert error:", error);
      return NextResponse.json({ ok: false, error: "insert_failed" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, id: inserted.id });
  } catch (err) {
    console.error("[feedback] route error:", err);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
