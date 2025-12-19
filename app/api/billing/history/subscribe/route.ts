// app/api/billing/subscribe/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { stripe } from "@/lib/stripe";

type Database = any;

function createSupabaseFromCookies() {
  const cookieStore = cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        async get(name: string) {
          return (await cookieStore).get(name)?.value;
        },
      },
    }
  );
}

export async function POST(req: Request) {
  try {
    const { priceId } = (await req.json().catch(() => ({}))) as {
      priceId?: string;
    };

    if (!priceId) {
      return NextResponse.json({ error: "bad_request", message: "priceId required" }, { status: 400 });
    }

    const supabase = createSupabaseFromCookies();
    const { data: userData, error: userErr } = await supabase.auth.getUser();

    if (userErr || !userData?.user?.id) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const authUserId = userData.user.id;
    const email = userData.user.email ?? undefined;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: email,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: `${appUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/pricing?canceled=1`,
      metadata: {
        auth_user_id: authUserId, // ✅ webhook側で plan 更新に使う
      },
    });

    return NextResponse.json({ ok: true, url: session.url });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
