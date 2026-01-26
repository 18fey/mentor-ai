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
  ref?: string | null; // ✅ 紹介コード（signup?ref=XXXX）
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

// ✅ ちょい安全：連絡先っぽい値はログに出さない
function maskContact(v: string | null | undefined) {
  if (!v) return null;
  if (v.includes("@")) {
    const [a, b] = v.split("@");
    return `${a.slice(0, 2)}***@${b}`;
  }
  return `${v.slice(0, 2)}***`;
}

export async function POST(req: Request) {
  const reqId = crypto.randomUUID(); // 1リクエストの追跡ID（便利）
  const startedAt = Date.now();

  try {
    const body = (await req.json().catch(() => ({}))) as RequestBody;

    console.log("[onboarding] start", {
      reqId,
      hasBody: !!body && Object.keys(body).length > 0,
      bodyKeys: body ? Object.keys(body) : [],
      body: {
        agreed: body?.agreed ?? undefined,
        planType: body?.planType ?? undefined,
        ref: body?.ref ?? undefined,
        contactMasked: maskContact(body?.contact ?? null),
      },
    });

    // ✅ セッションから user を確定
    const supabase = await createSupabaseFromCookies();
    const { data: auth, error: authErr } = await supabase.auth.getUser();
    const user = auth?.user ?? null;
    const authUserId = user?.id ?? null;

    console.log("[onboarding] auth", {
      reqId,
      authErr: authErr?.message ?? null,
      hasUser: !!authUserId,
      authUserId,
    });

    if (authErr || !authUserId) {
      console.warn("[onboarding] not_authenticated", { reqId });
      return NextResponse.json(
        { ok: false, error: "not_authenticated" },
        { status: 401 }
      );
    }

    // 規約チェックはデフォルト true（同意前提）
    const agreed = body.agreed ?? true;
    const planType = body.planType ?? "beta_free";
    const contact = body.contact ?? null;

    // ✅ 紹介コード（ref）
    const ref = (body.ref ?? null)?.trim() || null;

    console.log("[onboarding] normalized", {
      reqId,
      agreed,
      planType,
      contactMasked: maskContact(contact),
      ref,
    });

    // 既存の referred_by を確認（profiles.id === authUserId 前提）
    const { data: existing, error: existingErr } = await supabaseServer
      .from("profiles")
      .select("id, auth_user_id, referred_by")
      .eq("id", authUserId)
      .maybeSingle();

    console.log("[onboarding] existing_profile_check", {
      reqId,
      existingErr: existingErr?.message ?? null,
      existing: existing
        ? {
            id: (existing as any).id ?? null,
            auth_user_id: (existing as any).auth_user_id ?? null,
            referred_by: (existing as any).referred_by ?? null,
          }
        : null,
    });

    const referredByToSave =
      (existing as any)?.referred_by ? (existing as any).referred_by : ref;

    // ✅ profiles 不変ルール：profiles.id === auth.users.id
    const payload = {
      id: authUserId,              // ✅ 追加（最重要）
      auth_user_id: authUserId,    // 冗長だけど外部参照に使うならOK
      agreed_terms: agreed,
      agreed_terms_at: new Date().toISOString(),
      plan_type: planType,
      beta_user: true,
      contact_optional: contact,
      referred_by: referredByToSave,
    };

    console.log("[onboarding] upsert_payload", {
      reqId,
      payload: {
        ...payload,
        contact_optional: maskContact(payload.contact_optional),
      },
      onConflict: "id",
    });

    // ✅ onConflict も id に統一
    const { error: upsertErr } = await supabaseServer
      .from("profiles")
      .upsert(payload, { onConflict: "id" });

    if (upsertErr) {
      console.error("[onboarding] upsert error", {
        reqId,
        message: upsertErr.message,
        details: (upsertErr as any).details ?? null,
        hint: (upsertErr as any).hint ?? null,
        code: (upsertErr as any).code ?? null,
      });

      return NextResponse.json(
        { ok: false, error: "failed_to_upsert_profiles" },
        { status: 500 }
      );
    }

    console.log("[onboarding] success", {
      reqId,
      ms: Date.now() - startedAt,
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[onboarding] route error", {
      reqId,
      ms: Date.now() - startedAt,
      message: e?.message ?? String(e),
      stack: e?.stack ?? null,
    });

    return NextResponse.json(
      { ok: false, error: "internal_error" },
      { status: 500 }
    );
  }
}
