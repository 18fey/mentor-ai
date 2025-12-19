// app/api/subscription/checkout/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { stripe } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Plan = "pro" | "elite";

const PRICE_ENV: Record<Plan, string> = {
  pro: "STRIPE_PRICE_PRO",
  elite: "STRIPE_PRICE_ELITE",
};

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get: (name) => cookieStore.get(name)?.value } }
    );

    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as { plan?: Plan };
    const plan: Plan = body.plan ?? "pro";

    const priceId = process.env[PRICE_ENV[plan]];
    if (!priceId) {
      return NextResponse.json(
        { error: `missing env ${PRICE_ENV[plan]}` },
        { status: 500 }
      );
    }

    const origin =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      client_reference_id: user.id, // ✅ userId を必ず残す保険
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/pricing?status=success`,
      cancel_url: `${origin}/pricing?status=cancel`,
      allow_promotion_codes: true,

      // ✅ subscription にも user_id を埋める（更新/解約イベントでも userId 取得できる）
      subscription_data: {
        metadata: {
          user_id: user.id,
          plan,
        },
      },

      // ✅ session にも（checkout.session.completed で確実に取れる）
      metadata: {
        user_id: user.id,
        plan,
      },
    });

    return NextResponse.json({ checkoutUrl: session.url }, { status: 200 });
  } catch (e) {
    console.error("subscription checkout error:", e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
