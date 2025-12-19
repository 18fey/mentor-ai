// app/api/stripe/webhook/subscription/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { stripe } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ================================
// ENV
// ================================
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET_SUBSCRIPTION;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ================================
// Utils
// ================================
function planFromSubscriptionStatus(
  status: Stripe.Subscription.Status
): "pro" | "free" {
  const proStatuses: Stripe.Subscription.Status[] = ["active", "trialing"];
  return proStatuses.includes(status) ? "pro" : "free";
}

/**
 * Stripeのイベントから「profiles.id (= auth.users.id)」を取り出す
 * - checkout.session.completed: metadata.user_id or client_reference_id
 * - subscription.updated/deleted: subscription.metadata.user_id (設定していれば) / (無ければ fallback)
 */
function extractUserIdFromEvent(event: Stripe.Event): string | null {
  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId =
        (session.metadata?.user_id as string | undefined) ??
        (session.client_reference_id as string | undefined) ??
        null;
      return userId;
    }

    if (
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const sub = event.data.object as Stripe.Subscription;
      const userId = (sub.metadata?.user_id as string | undefined) ?? null;
      return userId;
    }

    return null;
  } catch {
    return null;
  }
}

async function updateProfileByUserId(params: {
  userId: string;
  plan?: "free" | "pro";
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
}) {
  const { userId, plan, stripeCustomerId, stripeSubscriptionId } = params;

  const patch: any = {};
  if (plan) patch.plan = plan;
  if (stripeCustomerId !== undefined) patch.stripe_customer_id = stripeCustomerId;
  if (stripeSubscriptionId !== undefined)
    patch.stripe_subscription_id = stripeSubscriptionId;

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .update(patch)
    .eq("id", userId) // ✅ 統一: profiles.id = auth.users.id
    .select("id, plan, stripe_customer_id, stripe_subscription_id")
    .maybeSingle();

  if (error) {
    console.error("❌ updateProfileByUserId failed:", { userId, patch, error });
  } else {
    console.log("🧩 profiles updated (by userId):", data);
  }
}

/**
 * metadata に user_id が無い事故に備えた fallback
 * customer_id or subscription_id から profiles を特定して更新する
 */
async function findUserIdByStripeIds(params: {
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
}): Promise<string | null> {
  const { stripeCustomerId, stripeSubscriptionId } = params;

  // subscription_id 優先
  if (stripeSubscriptionId) {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("stripe_subscription_id", stripeSubscriptionId)
      .maybeSingle();

    if (error) console.error("findUserIdByStripeIds(sub) error:", error);
    if (data?.id) return data.id;
  }

  // customer_id 次点
  if (stripeCustomerId) {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("stripe_customer_id", stripeCustomerId)
      .maybeSingle();

    if (error) console.error("findUserIdByStripeIds(customer) error:", error);
    if (data?.id) return data.id;
  }

  return null;
}

// ================================
// Handler
// ================================
export async function POST(req: Request) {
  try {
    if (!webhookSecret) {
      return NextResponse.json(
        { error: "missing webhook secret" },
        { status: 500 }
      );
    }

    // ✅ Webhook は raw text 必須
    const body = await req.text();

    const sig = req.headers.get("stripe-signature");
    if (!sig) {
      return NextResponse.json(
        { error: "missing stripe-signature" },
        { status: 400 }
      );
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
    } catch (e) {
      console.error("❌ signature verify failed:", e);
      return NextResponse.json({ error: "bad signature" }, { status: 400 });
    }

    console.log("🔔 stripe event:", event.type);

    // まず userId を metadata / client_reference_id から取得
    let userId = extractUserIdFromEvent(event);

    switch (event.type) {
      /**
       * ✅ 初回購入確定（Checkout 完了）
       * - profiles.id (= userId) を更新
       */
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription") break;

        const stripeCustomerId = (session.customer as string) ?? null;
        const stripeSubscriptionId = (session.subscription as string) ?? null;

        // userId が取れなければ fallback（基本は取れるはず）
        if (!userId) {
          console.warn("⚠️ checkout.session.completed: userId missing", {
            sessionId: session.id,
            metadata: session.metadata,
            client_reference_id: session.client_reference_id,
          });

          userId = await findUserIdByStripeIds({
            stripeCustomerId,
            stripeSubscriptionId,
          });
        }

        if (!userId) break;

        await updateProfileByUserId({
          userId,
          plan: "pro",
          stripeCustomerId,
          stripeSubscriptionId,
        });

        break;
      }

      /**
       * 🔄 サブスク状態更新
       */
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;

        const stripeCustomerId = (sub.customer as string) ?? null;
        const stripeSubscriptionId = sub.id;

        const nextPlan = planFromSubscriptionStatus(sub.status);

        // userId が取れない場合は DB から逆引き
        if (!userId) {
          userId = await findUserIdByStripeIds({
            stripeCustomerId,
            stripeSubscriptionId,
          });
        }

        if (!userId) break;

        await updateProfileByUserId({
          userId,
          plan: nextPlan,
          stripeCustomerId,
          stripeSubscriptionId,
        });

        break;
      }

      /**
       * ❌ 解約（Stripe Portal / 即時解約）
       */
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;

        const stripeCustomerId = (sub.customer as string) ?? null;
        const stripeSubscriptionId = sub.id;

        if (!userId) {
          userId = await findUserIdByStripeIds({
            stripeCustomerId,
            stripeSubscriptionId,
          });
        }

        if (!userId) break;

        await updateProfileByUserId({
          userId,
          plan: "free",
          stripeCustomerId,
          stripeSubscriptionId,
        });

        break;
      }

      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (e) {
    console.error("❌ webhook server error:", e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
