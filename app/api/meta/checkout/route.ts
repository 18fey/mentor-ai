// app/api/meta/checkout/route.ts
import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
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

// ✅ Meta返金ポリシー（同意対象）のバージョン
// 運用時は必ず環境変数で固定するのが安全（文面更新のたびに更新）
const META_REFUND_VERSION =
  process.env.META_REFUND_VERSION || "2026-01-15"; // fallback（とりあえず）

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: { get: (name) => cookieStore.get(name)?.value },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });

    // ✅ agree を受け取る
    const body = (await req.json().catch(() => ({}))) as {
      pack?: MetaPack;
      agree?: boolean;
      // もしフロントから version 送りたいなら受けてもOK（基本はサーバ側の固定version推奨）
      metaRefundVersion?: string;
    };

    const pack = body.pack;
    if (!pack || !(pack in PACK_PRICE_MAP)) {
      return NextResponse.json({ error: "不正なパック指定です。" }, { status: 400 });
    }

    // ✅ 同意必須（ここが肝）
    if (body.agree !== true) {
      return NextResponse.json(
        { error: "購入前に返金ポリシー（Metaコイン）への同意が必要です。" },
        { status: 400 }
      );
    }

    const cfg = PACK_PRICE_MAP[pack];
    const priceId = process.env[cfg.priceIdEnv];
    if (!priceId) return NextResponse.json({ error: `missing env ${cfg.priceIdEnv}` }, { status: 500 });

    const origin =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      "http://localhost:3000";

    // ✅ version（原則サーバ固定）
    const version = META_REFUND_VERSION;

    // =====================================================
    // ✅ 1) profilesに「最新状態」を保存
    // =====================================================
    // profiles の PK が auth_user_id 前提（あなたのスクショだと auth_user_id がある）
    // もしPKが別なら where 句を調整してね。
    const nowIso = new Date().toISOString();

    const { error: profErr } = await supabase
      .from("profiles")
      .update({
        agreed_meta_refund: true,
        meta_refund_at: nowIso,
        meta_refund_version: version,
      })
      .eq("auth_user_id", user.id);

    if (profErr) {
      console.error("profiles update error:", profErr);
      return NextResponse.json({ error: "同意情報の保存に失敗しました。" }, { status: 500 });
    }

    // =====================================================
    // ✅ 2) policy_acceptances に「証跡」を保存（upsertで二重OK）
    // =====================================================
    const h = await headers();
    const userAgent = h.get("user-agent") || null;

    // x-forwarded-for は "client, proxy1, proxy2" みたいに来る
    const xff = h.get("x-forwarded-for");
    const ip = xff ? xff.split(",")[0].trim() : null;

    const { error: accErr } = await supabase
      .from("policy_acceptances")
      .upsert(
        {
          user_id: user.id,
          policy_key: "meta_refund",
          version,
          accepted: true,
          source: "api/meta/checkout",
          ip,
          user_agent: userAgent,
          metadata: { pack, meta_amount: cfg.amount },
        },
        { onConflict: "user_id,policy_key,version" }
      );

    if (accErr) {
      console.error("policy_acceptances upsert error:", accErr);
      return NextResponse.json({ error: "同意ログの保存に失敗しました。" }, { status: 500 });
    }

    // =====================================================
    // ✅ 3) Stripe Checkout Session 作成（metadataにも残す）
    // =====================================================
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/pricing?status=success`,
      cancel_url: `${origin}/pricing?status=cancel`,
      client_reference_id: user.id,

      metadata: {
        auth_user_id: user.id,
        meta_amount: String(cfg.amount),
        pack,
        meta_refund_version: version,
        meta_refund_agreed: "true",

        // 旧キー（移行保険）
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
