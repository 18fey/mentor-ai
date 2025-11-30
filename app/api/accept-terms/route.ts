// app/api/accept-terms/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export const runtime = "nodejs";

type AcceptTermsBody = {
  userId?: string;     // フロントから渡す Supabase auth.user.id
  authUserId?: string; // 将来の拡張用（どちらでもOK）
};

function getLogicalUserId(body: AcceptTermsBody | null): string | null {
  if (!body) return null;
  return body.authUserId ?? body.userId ?? null;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as AcceptTermsBody | null;
    const userId = getLogicalUserId(body);

    // ✅ demo-user にフォールバックせず、本番仕様では必須
    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "user_not_authenticated" },
        { status: 401 }
      );
    }

    // auth_user_id 単位で完全にユーザーを分ける
    const { error } = await supabaseServer
      .from("users_profile")
      .update({
        accepted_terms: true,
        accepted_terms_at: new Date().toISOString(),
      })
      .eq("auth_user_id", userId);

    if (error) {
      console.error("[accept-terms] Supabase update error:", error);
      return NextResponse.json(
        { ok: false, error: "supabase_update_failed" },
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
