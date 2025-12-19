// app/api/saves/list/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { getUserPlan } from "@/lib/plan";

type SaveType = "mistake" | "learning" | "retry";
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

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      saveType?: SaveType;
      attemptType?: string;
      limit?: number;
    };

    const supabase = createSupabaseFromCookies();
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user?.id) {
      return NextResponse.json(
        { error: "unauthorized", message: "login required" },
        { status: 401 }
      );
    }

    const userId = userData.user.id;
    const plan = await getUserPlan(userId);

    let q = supabaseAdmin
      .from("saved_items")
      .select(
        "id, attempt_type, attempt_id, save_type, title, summary, score_total, created_at, payload, source_id"
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (body.saveType) q = q.eq("save_type", body.saveType);
    if (body.attemptType) q = q.eq("attempt_type", body.attemptType);

    const lim = typeof body.limit === "number" ? body.limit : 50;
    q = q.limit(Math.max(1, Math.min(200, lim)));

    const { data, error } = await q;
    if (error) throw error;

    return NextResponse.json({ ok: true, plan, items: data ?? [] });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
