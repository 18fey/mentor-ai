// app/api/stripe/webhook/meta/route.ts
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { stripe } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET_META;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    if (!webhookSecret) {
      return NextResponse.json({ error: "missing webhook secret" }, { status: 500 });
    }

    const body = await req.text();
    const sig = (await headers()).get("stripe-signature");
    if (!sig) return NextResponse.json({ error: "missing signature" }, { status: 400 });

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
    } catch (e) {
      console.error("signature verify failed", e);
      return NextResponse.json({ error: "bad signature" }, { status: 400 });
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== "payment") return NextResponse.json({ received: true });

      // ✅ 新キー優先、無ければ旧キーも読む（移行期間）
      const authUserId =
        (session.metadata?.auth_user_id as string | undefined) ??
        (session.metadata?.userId as string | undefined);

      const amountStr =
        (session.metadata?.meta_amount as string | undefined) ??
        (session.metadata?.metaAmount as string | undefined);

      if (!authUserId || !amountStr) return NextResponse.json({ received: true });

      const amount = Number(amountStr);
      if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ received: true });

      const purchasedAt = new Date();
      const expiresAt = new Date(purchasedAt.getTime() + 180 * 24 * 60 * 60 * 1000);

      // ✅ ロット発行
      const { error: lotErr } = await supabaseAdmin.from("meta_lots").insert({
        auth_user_id: authUserId,
        purchased_at: purchasedAt.toISOString(),
        expires_at: expiresAt.toISOString(),
        initial_amount: amount,
        remaining: amount,
        source: "stripe",
        stripe_payment_intent_id: session.payment_intent as string,
      });

      if (lotErr) {
        console.error("meta_lots insert error:", lotErr);
        return NextResponse.json({ received: true });
      }

      // ✅ キャッシュ加算（RPC）
      const { error: incErr } = await supabaseAdmin.rpc("increment_meta_balance", {
        p_auth_user_id: authUserId,
        p_amount: amount,
      });
      if (incErr) console.error("increment_meta_balance rpc error:", incErr);

      // ✅ 監査ログ（任意）
      const { error: evErr } = await supabaseAdmin.from("meta_events").insert({
        auth_user_id: authUserId,
        type: "grant",
        amount,
        reason: "stripe_purchase",
      });
      if (evErr) console.error("meta_events insert error:", evErr);
    }

    return NextResponse.json({ received: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
