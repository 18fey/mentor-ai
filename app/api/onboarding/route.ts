// app/api/onboarding/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { supabaseServer } from "@/lib/supabase-server";

type Database = any;

type RequestBody = {
  agreed?: boolean;
  planType?: string;
  contact?: string | null;
  ref?: string | null; // ✅ 追加：紹介コード（signup?ref=XXXX）
};

export const runtime = "nodejs";

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
    const body = (await req.json().catch(() => ({}))) as RequestBody;

    // ✅ セッションから user を確定（bodyのauthUserIdは使わない）
    const supabase = await createSupabaseFromCookies();
    const { data: auth, error: authErr } = await supabase.auth.getUser();
    const user = auth?.user ?? null;
    const authUserId = user?.id ?? null;

    if (authErr || !authUserId) {
      return NextResponse.json(
        { ok: false, error: "not_authenticated" },
        { status: 401 }
      );
    }

    // 規約チェックはデフォルト true（同意前提）
    const agreed = body.agreed ?? true;
    const planType = body.planType ?? "beta_free";
    const contact = body.contact ?? null;

    // ✅ 紹介コード（ref）を保存したい場合
    // - すでに referred_by が入っているなら上書きしない（後から差し替え防止）
    const ref = (body.ref ?? null)?.trim() || null;

    // 既存の referred_by を確認
    const { data: existing, error: existingErr } = await supabaseServer
      .from("profiles")
      .select("id, referred_by")
      .eq("id", authUserId)
      .maybeSingle();

    const referredByToSave =
      existing?.referred_by ? existing.referred_by : ref;

    //profiles✅  を upsert（なければ作る、あれば更新）
    const { error: upsertErr } = await supabaseServer
      .from("profiles")
      .upsert(
        {
          auth_user_id: authUserId,
          agreed_terms: agreed,
          agreed_terms_at: new Date().toISOString(),
          plan_type: planType,
          beta_user: true,
          contact_optional: contact,
          referred_by: referredByToSave, // ✅ ここで保存
        },
        { onConflict: "auth_user_id" }
      );

    if (upsertErr) {
      console.error("[onboarding] upsert error:", upsertErr);
      return NextResponse.json(
        { ok: false, error: "failed_to_upsert_profiles" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[onboarding] route error:", e);
    return NextResponse.json(
      { ok: false, error: "internal_error" },
      { status: 500 }
    );
  }
}
