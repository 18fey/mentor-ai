// app/api/stripe/webhook/meta/route.ts
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { stripe } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET_META;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// ✅ service role client（サーバー専用）
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Postgres unique violation
function isUniqueViolation(err: any) {
  return String(err?.code ?? "") === "23505";
}

// ✅ JWTを雑にdecode（検証は不要。roleを見るだけ）
function decodeJwtPayload(token: string) {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = parts[1];
    const json = Buffer.from(payload, "base64").toString("utf8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  try {
    console.log("\n====================");
    console.log("[meta webhook] HIT");

    // --- env check ---
    console.log("[meta webhook] ENV CHECK", {
      hasUrl: !!supabaseUrl,
      hasServiceRoleKey: !!serviceRoleKey,
      serviceRoleKeyLength: serviceRoleKey?.length ?? 0,
      hasWebhookSecret: !!webhookSecret,
    });

    // ✅ ここが最重要：service role key のJWT payloadを出す（role確認）
    const payload = decodeJwtPayload(serviceRoleKey);
    console.log("[meta webhook] SERVICE KEY JWT PAYLOAD", payload);
    // ここで payload.role が "service_role" じゃないなら、キーが違う（ほぼ確定）

    if (!webhookSecret) {
      return NextResponse.json({ error: "missing webhook secret" }, { status: 500 });
    }

    const rawBody = await req.text();
    const sig = (await headers()).get("stripe-signature");
    if (!sig) return NextResponse.json({ error: "missing signature" }, { status: 400 });

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    } catch (e) {
      console.error("❌ signature verify failed", e);
      return NextResponse.json({ error: "bad signature" }, { status: 400 });
    }

    if (event.type !== "checkout.session.completed") {
      console.log("[meta webhook] ignore event.type =", event.type);
      return NextResponse.json({ received: true });
    }

    const session = event.data.object as Stripe.Checkout.Session;
    if (session.mode !== "payment") {
      console.log("[meta webhook] ignore session.mode =", session.mode);
      return NextResponse.json({ received: true });
    }

    const authUserId =
      (session.metadata?.auth_user_id as string | undefined) ??
      (session.metadata?.userId as string | undefined) ??
      null;

    const amountStr =
      (session.metadata?.meta_amount as string | undefined) ??
      (session.metadata?.metaAmount as string | undefined) ??
      null;

    console.log("[meta webhook] METADATA", {
      sessionId: session.id,
      authUserId,
      amountStr,
      metadata: session.metadata,
      payment_intent: session.payment_intent,
    });

    if (!authUserId || !amountStr) {
      console.warn("⚠️ missing metadata");
      return NextResponse.json({ received: true });
    }

    const amount = Number(amountStr);
    if (!Number.isFinite(amount) || amount <= 0) {
      console.warn("⚠️ invalid amount", { amountStr });
      return NextResponse.json({ received: true });
    }

    const paymentIntentId = session.payment_intent as string | null;
    if (!paymentIntentId) {
      console.warn("⚠️ missing payment_intent", { sessionId: session.id });
      return NextResponse.json({ received: true });
    }

    const purchasedAt = new Date();
    const expiresAt = new Date(purchasedAt.getTime() + 180 * 24 * 60 * 60 * 1000);

    console.log("[meta webhook] INSERT meta_lots", {
      authUserId,
      amount,
      paymentIntentId,
      purchasedAt: purchasedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    });

    const { error: lotErr } = await supabaseAdmin.from("meta_lots").insert({
      auth_user_id: authUserId,
      purchased_at: purchasedAt.toISOString(),
      expires_at: expiresAt.toISOString(),
      initial_amount: amount,
      remaining: amount,
      source: "stripe",
      stripe_payment_intent_id: paymentIntentId,
    });

    if (lotErr) {
      if (isUniqueViolation(lotErr)) {
        console.log("🟡 meta_lots already inserted (idempotent)", { paymentIntentId });
        return NextResponse.json({ received: true, deduped: true });
      }
      console.error("❌ meta_lots insert error:", lotErr);
      return NextResponse.json({ received: true, lot_insert_failed: true });
    }

    console.log("✅ meta_lots insert success");

    // meta_events（任意）
    try {
      const { error: evErr } = await supabaseAdmin.from("meta_events").insert({
        auth_user_id: authUserId,
        type: "grant",
        amount,
        reason: "stripe_purchase",
      });
      if (evErr) console.error("meta_events insert error:", evErr);
      else console.log("✅ meta_events insert success");
    } catch (e) {
      console.error("meta_events insert threw:", e);
    }

    return NextResponse.json({ received: true });
  } catch (e) {
    console.error("❌ meta webhook server error:", e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
