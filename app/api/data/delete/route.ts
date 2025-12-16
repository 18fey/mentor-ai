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

async function resolveProfileIdFromAuthUserId(authUserId: string) {
  // profiles.id = auth.users.id 運用が残ってるケース
  const { data: byId } = await supabaseServer
    .from("profiles")
    .select("id")
    .eq("id", authUserId)
    .maybeSingle();

  if (byId?.id) return byId.id;

  // profiles.auth_user_id 運用のケース
  const { data: byAuth } = await supabaseServer
    .from("profiles")
    .select("id")
    // @ts-ignore
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (byAuth?.id) return byAuth.id;

  return null;
}

export async function POST(_req: NextRequest) {
  try {
    const supabase = await createSupabaseFromCookies();
    const { data: auth, error: authErr } = await supabase.auth.getUser();
    const user = auth?.user ?? null;

    if (authErr || !user?.id) {
      return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
    }

    const authUserId = user.id;
    const profileId = await resolveProfileIdFromAuthUserId(authUserId);

    const results: any[] = [];

    // ✅ user_id で紐づくもの（あなたの既存）
    results.push(await supabaseServer.from("story_cards").delete().eq("user_id", authUserId));
    results.push(await supabaseServer.from("interview_sessions").delete().eq("user_id", authUserId));
    results.push(await supabaseServer.from("interview_turns").delete().in("session_id", [])); // 使ってるなら後で最適化（下に説明）

    // ✅ profile_id で紐づくもの（あるなら消す）
    if (profileId) {
      // 例：es_logs / es_corrections / feature_usage など
      results.push(await supabaseServer.from("es_logs").delete().eq("profile_id", profileId));
      results.push(await supabaseServer.from("es_corrections").delete().eq("profile_id", profileId));
      results.push(await supabaseServer.from("feature_usage").delete().eq("profile_id", profileId));
      // growth_logs が profile_id に移行してるならここも
      // results.push(await supabaseServer.from("growth_logs").delete().eq("profile_id", profileId));
    }

    // ✅ auth_user_id で紐づく profiles 更新/削除（設計移行中の保険）
    results.push(await supabaseServer.from("profiles").delete().eq("auth_user_id", authUserId));
    // ✅ profiles.id = authUserId の運用も残ってるならこちらも
    results.push(await supabaseServer.from("profiles").delete().eq("id", authUserId));

    const errors = results.map((r) => r?.error).filter(Boolean);

    if (errors.length > 0) {
      console.error("[data/delete] delete errors:", errors);
      return NextResponse.json(
        { ok: false, error: "failed_to_delete_some_data", detail: errors },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    console.error("[data/delete] exception:", e);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
