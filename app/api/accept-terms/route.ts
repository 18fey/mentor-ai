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

type AcceptTermsBody = {
  // ✅ userId は受け取らない（偽装不可）
  is_adult: boolean;     // チェックボックス or 生年月日判定結果
  terms_version: string; // "2025-12-02" など（あなたが管理するバージョン）
};

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseFromCookies();
    const { data: auth, error: authErr } = await supabase.auth.getUser();
    const user = auth?.user ?? null;

    if (authErr || !user?.id) {
      return NextResponse.json(
        { ok: false, error: "not_authenticated" },
        { status: 401 }
      );
    }

    // body validate（軽く）
    let body: AcceptTermsBody | null = null;
    try {
      body = (await req.json()) as AcceptTermsBody;
    } catch {
      body = null;
    }

    if (!body || typeof body.is_adult !== "boolean" || !body.terms_version) {
      return NextResponse.json(
        { ok: false, error: "invalid_body" },
        { status: 400 }
      );
    }

    const nowIso = new Date().toISOString();

    // ✅ profiles.id === auth.users.id ルールに完全準拠
    // ✅ upsert で「空行が無い」事故でも OK
    const payload = {
      id: user.id,
      agreed_terms: true,
      agreed_terms_at: nowIso,
      terms_version: body.terms_version,
      is_adult: body.is_adult,
      is_adult_at: nowIso,
    };

    const { error } = await supabaseServer
      .from("profiles")
      .upsert(payload, { onConflict: "id" });

    if (error) {
      console.error("[accept-terms] Supabase upsert error:", error);
      return NextResponse.json(
        { ok: false, error: "supabase_upsert_failed" },
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
