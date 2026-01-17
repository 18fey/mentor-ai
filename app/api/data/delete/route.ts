// app/api/data/delete/route.ts
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

export async function POST(req: NextRequest) {
  try {
    // 1) 認証（cookie auth）
    const supabase = await createSupabaseFromCookies();
    const { data: auth, error: authErr } = await supabase.auth.getUser();
    const user = auth?.user ?? null;

    if (authErr || !user?.id) {
      return NextResponse.json(
        { ok: false, error: "not_authenticated" },
        { status: 401 }
      );
    }

    const authUserId = user.id;
    const email = user.email ?? null;

    // 2) 任意：理由などを受け取る（UIが送ってないなら空でOK）
    const body = await req.json().catch(() => ({}));
    const reason =
      typeof body?.reason === "string" ? body.reason.slice(0, 500) : null;

    // 3) 直近24hのpendingがあれば重複作成しない（連打/二重送信対策）
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recent, error: recentErr } = await supabaseServer
      .from("data_deletion_requests")
      .select("id, status, requested_at")
      .eq("auth_user_id", authUserId)
      .eq("status", "pending")
      .gte("requested_at", since)
      .order("requested_at", { ascending: false })
      .limit(1);

    if (!recentErr && recent && recent.length > 0) {
      return NextResponse.json(
        {
          ok: true,
          deduped: true,
          requestId: recent[0].id,
          status: recent[0].status,
          requestedAt: recent[0].requested_at,
        },
        { status: 200 }
      );
    }

    // 4) 保存（Service Roleで確実にinsert）
    const { data: inserted, error: insErr } = await supabaseServer
      .from("data_deletion_requests")
      .insert({
        auth_user_id: authUserId,
        email,
        status: "pending",
        reason,
        meta: {
          source: "settings_button",
          user_agent: req.headers.get("user-agent") ?? null,
        },
      })
      .select("id, status, requested_at")
      .single();

    if (insErr || !inserted) {
      console.error("[data/delete] insert request error:", insErr);
      return NextResponse.json(
        { ok: false, error: "insert_failed" },
        { status: 500 }
      );
    }

    // 5) 受付完了
    return NextResponse.json(
      {
        ok: true,
        requestId: inserted.id,
        status: inserted.status,
        requestedAt: inserted.requested_at,
      },
      { status: 200 }
    );
  } catch (e) {
    console.error("[data/delete] exception:", e);
    return NextResponse.json(
      { ok: false, error: "server_error" },
      { status: 500 }
    );
  }
}
