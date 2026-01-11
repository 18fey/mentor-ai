// app/api/usage/log/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type FeatureKey =
  | "case_interview"
  | "case_generate"
  | "fermi_generate"
  | "fermi"
  | "interview_10"
  | "ai_training"
  | "es_correction"
  | "industry_insight"
  | "enterprise_qgen"
  | "es_draft";

const VALID_FEATURES: Record<FeatureKey, true> = {
  case_interview: true,
  case_generate: true,
  fermi_generate: true,
  fermi: true,
  interview_10: true,
  ai_training: true,
  es_correction: true,
  industry_insight: true,
  enterprise_qgen: true,
  es_draft: true,
};

async function createSupabaseFromCookies() {
  const cookieStore = await cookies();
  return createServerClient(
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

function reqId() {
  return Math.random().toString(36).slice(2, 10);
}

export async function POST(req: NextRequest) {
  const rid = reqId();

  try {
    const supabase = await createSupabaseFromCookies();

    // ✅ auth
    const { data: auth, error: authErr } = await supabase.auth.getUser();
    const user = auth?.user ?? null;

    console.log(`[usage/log:${rid}] auth`, {
      ok: !!user?.id && !authErr,
      authErr: authErr?.message ?? null,
      userId: user?.id ?? null,
    });

    if (authErr || !user?.id) {
      return NextResponse.json(
        { ok: false, error: "unauthorized", message: "ログインが必要です。" },
        { status: 401 }
      );
    }

    const authUserId = user.id;

    const body = await req.json().catch(() => ({}));
    const feature = body.feature as FeatureKey | undefined;

    console.log(`[usage/log:${rid}] request`, { feature });

    if (!feature || !(feature in VALID_FEATURES)) {
      return NextResponse.json(
        { ok: false, error: "invalid_request", message: "feature が不正です。" },
        { status: 400 }
      );
    }

    // ✅ 成功後ログ：usage_logs に1件追加
    const { error: logErr } = await supabase.from("usage_logs").insert({
      user_id: authUserId,
      feature,
      used_at: new Date().toISOString(),
    });

    if (logErr) {
      console.error(`[usage/log:${rid}] usage_logs insert error:`, logErr);
      return NextResponse.json(
        { ok: false, error: "insert_failed", message: "利用ログの保存に失敗しました。" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      feature,
      message: "usage log committed",
    });
  } catch (e: any) {
    console.error(`[usage/log:${rid}] server_error:`, e);
    return NextResponse.json(
      { ok: false, error: "server_error", message: "利用ログ保存中にエラーが発生しました。" },
      { status: 500 }
    );
  }
}
