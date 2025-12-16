import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getUserPlan } from "@/lib/plan";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { userId, saveType } = (await req.json()) as {
      userId: string;
      saveType?: "mistake" | "learning" | "retry";
    };

    if (!userId) {
      return NextResponse.json({ error: "bad_request" }, { status: 400 });
    }

    const plan = await getUserPlan(userId);

    let q = supabaseAdmin
      .from("saved_items")
      .select("id, attempt_id, save_type, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (saveType) q = q.eq("save_type", saveType);

    const { data, error } = await q;
    if (error) throw error;

    return NextResponse.json({ ok: true, plan, items: data ?? [] });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
