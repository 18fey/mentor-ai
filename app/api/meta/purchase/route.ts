// app/api/meta/purchase/route.ts
import Stripe from "stripe";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  // Stripe ダッシュボード側の現在のバージョンに合わせて OK
  apiVersion: "2025-11-17.clover",
});

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// どの数量の Meta を売るかを型で定義
type MetaAmount = "3" | "7" | "15";

// meta 数量 → 価格 ID を定義（型安全）
const META_PACKS: Record<MetaAmount, { priceId: string }> = {
  "3": { priceId: process.env.STRIPE_META_10! },
  "7": { priceId: process.env.STRIPE_META_30! },
  "15": { priceId: process.env.STRIPE_META_100! },
};

export async function POST(req: Request) {
  const { userId, amount } = (await req.json()) as {
    userId?: string;
    amount?: MetaAmount;
  };

  // リクエストのバリデーション
  if (!userId || !amount) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const pack = META_PACKS[amount];

  if (!pack) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  }

  // Stripe Checkout セッション作成
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{ price: pack.priceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/meta/success`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/meta/cancel`,
    client_reference_id: userId,
    metadata: { amount },
  });

  return NextResponse.json({ url: session.url });
}
