// app/api/meta/consume/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  const { userId, cost } = await req.json();

  if (!userId || typeof cost !== "number") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // 残高チェック
  const { data: wallet } = await supabase
    .from("meta_wallet")
    .select("balance")
    .eq("user_id", userId)
    .single();

  if (!wallet || wallet.balance < cost) {
    return NextResponse.json(
      { error: "INSUFFICIENT_META" },
      { status: 402 } // Payment Required
    );
  }

  // 残高更新
  await supabase
    .from("meta_wallet")
    .update({ balance: wallet.balance - cost })
    .eq("user_id", userId);

  return NextResponse.json({ ok: true });
}
