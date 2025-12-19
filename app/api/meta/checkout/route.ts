// app/api/meta/checkout/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { stripe } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MetaPack = "meta_3" | "meta_7" | "meta_15";

const PACK_PRICE_MAP: Record<MetaPack, { priceIdEnv: string; amount: number }> = {
  meta_3: { priceIdEnv: "STRIPE_PRICE_META_3", amount: 3 },
  meta_7: { priceIdEnv: "STRIPE_PRICE_META_7", amount: 7 },
  meta_15: { priceIdEnv: "STRIPE_PRICE_META_15", amount: 15 },
};

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get: (name) => cookieStore.get(name)?.value } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as { pack?: MetaPack };
    const pack = body.pack;
    if (!pack || !(pack in PACK_PRICE_MAP)) {
      return NextResponse.json({ error: "不正なパック指定です。" }, { status: 400 });
    }

    const cfg = PACK_PRICE_MAP[pack];
    const priceId = process.env[cfg.priceIdEnv];
    if (!priceId) return NextResponse.json({ error: `missing env ${cfg.priceIdEnv}` }, { status: 500 });

    const origin =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/pricing?status=success`,
      cancel_url: `${origin}/pricing?status=cancel`,
      client_reference_id: user.id,

      // ✅ 新キー（正）
      metadata: {
        auth_user_id: user.id,
        meta_amount: String(cfg.amount),
        pack,

        // ✅ 旧キーも念のため残す（移行期間の保険）
        userId: user.id,
        metaAmount: String(cfg.amount),
      },
    });

    return NextResponse.json({ checkoutUrl: session.url }, { status: 200 });
  } catch (err) {
    console.error("meta checkout error:", err);
    return NextResponse.json({ error: "決済セッションの作成に失敗しました。" }, { status: 500 });
  }
}
