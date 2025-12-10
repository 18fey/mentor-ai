// app/api/meta/checkout/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import Stripe from "stripe";

export const dynamic = "force-dynamic";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  console.warn("STRIPE_SECRET_KEY is not set");
}

const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, {
      apiVersion: "2025-11-17.clover", // ✅ 実在するバージョンに変更
    })
  : null;

// /api/meta/checkout に投げる pack の型
type MetaPack = "meta_3" | "meta_7" | "meta_15";

// パックごとの PriceID と、付与 META 数
const PACK_PRICE_MAP: Record<
  MetaPack,
  { priceIdEnv: string; successMetaAmount: number }
> = {
  meta_3: { priceIdEnv: "STRIPE_PRICE_META_3", successMetaAmount: 3 },
  meta_7: { priceIdEnv: "STRIPE_PRICE_META_7", successMetaAmount: 7 },
  meta_15: { priceIdEnv: "STRIPE_PRICE_META_15", successMetaAmount: 15 },
};

export async function POST(req: Request) {
  try {
    if (!stripe) {
      return NextResponse.json(
        { error: "Stripe設定エラー（鍵がありません）" },
        { status: 500 }
      );
    }

    const cookieStore = await cookies();

    const supabase = createServerClient<any>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
        },
      }
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error("supabase auth error:", authError);
    }

    if (!user) {
      return NextResponse.json(
        { error: "ログインが必要です。" },
        { status: 401 }
      );
    }

    const body = (await req.json()) as { pack?: MetaPack };
    const pack = body.pack;

    if (!pack || !(pack in PACK_PRICE_MAP)) {
      return NextResponse.json(
        { error: "不正なパック指定です。" },
        { status: 400 }
      );
    }

    const { priceIdEnv, successMetaAmount } = PACK_PRICE_MAP[pack];
    const priceId = process.env[priceIdEnv];

    if (!priceId) {
      console.error(`環境変数 ${priceIdEnv} が設定されていません`);
      return NextResponse.json(
        { error: "決済設定エラー（Price が未設定）" },
        { status: 500 }
      );
    }

    const origin =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${origin}/meta?status=success`,
      cancel_url: `${origin}/meta?status=cancel`,
      metadata: {
        userId: user.id,
        metaPack: pack,
        metaAmount: successMetaAmount.toString(), // Webhook 側で使う
      },
    });

    return NextResponse.json(
      { checkoutUrl: session.url },
      { status: 200 }
    );
  } catch (err) {
    console.error("meta checkout error:", err);
    return NextResponse.json(
      { error: "決済セッションの作成に失敗しました。" },
      { status: 500 }
    );
  }
}
