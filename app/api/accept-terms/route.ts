// app/api/accept-terms/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export const runtime = "nodejs";

const DEFAULT_USER_ID = "demo-user";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const userId = body.userId ?? DEFAULT_USER_ID;

    const { error } = await supabaseServer
      .from("users_profile")
      .update({
        accepted_terms: true,
        accepted_terms_at: new Date().toISOString(),
      })
      .eq("id", userId);

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
