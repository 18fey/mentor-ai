import { NextResponse } from "next/server";
import { createServerSupabase } from "@/utils/supabase/server"; // いつものやつ

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createServerSupabase();

  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // ✅ 有効ロットだけ返す
  const { data, error } = await supabase
    .from("meta_lots")
    .select("id, expires_at, remaining, source, initial_amount, purchased_at")
    .eq("auth_user_id", user.id)
    .gt("remaining", 0)
    .gt("expires_at", new Date().toISOString())
    .order("expires_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ lots: data ?? [] });
}
