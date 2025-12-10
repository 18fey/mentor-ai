// app/api/stripe/webhook/route.ts
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

// Stripe シークレットキー
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET_META;

// Supabase 管理用クライアント（サービスロール）
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!stripeSecretKey) {
  console.warn("STRIPE_SECRET_KEY is not set");
}
if (!webhookSecret) {
  console.warn("STRIPE_WEBHOOK_SECRET_META is not set");
}
if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.warn("Supabase service role env is not set");
}

const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, { apiVersion: "2025-11-17.clover" })
  : null;

const supabaseAdmin =
  supabaseUrl && supabaseServiceRoleKey
    ? createClient(supabaseUrl, supabaseServiceRoleKey)
    : null;

// Webhook は Stripe から直接叩かれるので、
// ユーザーのクッキーに依存せず「サービスロール」で profiles を更新する。

export async function POST(req: Request) {
  try {
    if (!stripe || !webhookSecret || !supabaseAdmin) {
      return NextResponse.json(
        { error: "Webhook設定エラー" },
        { status: 500 }
      );
    }

    const body = await req.text();
    const sig = (await headers()).get("stripe-signature");

    if (!sig) {
      return NextResponse.json(
        { error: "署名ヘッダーがありません。" },
        { status: 400 }
      );
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
    } catch (err: any) {
      console.error("Stripe webhook signature verification failed:", err);
      return NextResponse.json(
        { error: "シグネチャ検証に失敗しました。" },
        { status: 400 }
      );
    }

    // ここからイベント別の処理
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      const userId = session.metadata?.userId;
      const metaAmountStr = session.metadata?.metaAmount;

      if (!userId || !metaAmountStr) {
        console.warn(
          "checkout.session.completed but missing metadata.userId or metaAmount"
        );
        return NextResponse.json({ received: true }, { status: 200 });
      }

      const metaAmount = Number(metaAmountStr);
      if (!Number.isFinite(metaAmount) || metaAmount <= 0) {
        console.warn("Invalid metaAmount in metadata:", metaAmountStr);
        return NextResponse.json({ received: true }, { status: 200 });
      }

      // 現在の残高を取得 → 加算
      const { data: profile, error: profileError } = await supabaseAdmin
        .from("profiles")
        .select("meta_balance")
        .eq("id", userId)
        .maybeSingle();

      if (profileError) {
        console.error("profiles select error:", profileError);
        return NextResponse.json({ received: true }, { status: 200 });
      }

      const current = profile?.meta_balance ?? 0;
      const newBalance = current + metaAmount;

      const { error: updateError } = await supabaseAdmin
        .from("profiles")
        .update({ meta_balance: newBalance })
        .eq("id", userId);

      if (updateError) {
        console.error("profiles update error:", updateError);
      } else {
        console.log(
          `Meta balance updated for user ${userId}: ${current} -> ${newBalance}`
        );
      }
    }

    // 他のイベントタイプはとりあえずログだけ
    else {
      console.log(`Unhandled Stripe event type: ${event.type}`);
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err) {
    console.error("Stripe webhook handler error:", err);
    return NextResponse.json(
      { error: "Webhook処理中にエラーが発生しました。" },
      { status: 500 }
    );
  }
}
