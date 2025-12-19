// app/api/meta/consume/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAuthUserId } from "@/lib/authServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  const authUserId = await requireAuthUserId();
  if (!authUserId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { cost } = await req.json().catch(() => ({} as any));
  if (typeof cost !== "number" || cost <= 0) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin.rpc("consume_meta_fifo", {
    p_auth_user_id: authUserId,
    p_cost: cost,
  });

  if (error) {
    const msg = String(error.message ?? "");
    if (msg.includes("INSUFFICIENT_META")) {
      return NextResponse.json({ error: "INSUFFICIENT_META" }, { status: 402 });
    }
    if (msg.includes("INVALID_COST")) {
      return NextResponse.json({ error: "INVALID_COST" }, { status: 400 });
    }
    console.error("consume_meta_fifo error:", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }

  return NextResponse.json(data ?? { ok: true });
}
