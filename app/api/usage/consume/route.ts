// app/api/usage/consume/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Plan = "free" | "pro";
type FeatureKey =
  | "case_interview"
  | "case_generate"
  | "fermi"
  | "general_interview"
  | "ai_training"
  | "es_correction";

// ✅ “無料枠”だけを定義（proは無制限）
const FREE_LIMITS: Record<FeatureKey, number> = {
  case_interview: 3,
  case_generate: 8,
  fermi: 7,
  general_interview: 1,
  ai_training: 1,
  es_correction: 1,
};

// ✅ 無料枠を超えたら必要な meta（都度課金）
const META_COST: Record<FeatureKey, number> = {
  case_interview: 1,
  case_generate: 1,
  fermi: 1,
  general_interview: 2,
  ai_training: 2,
  es_correction: 2,
};

function monthStartISO(now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth(), 1);
  return d.toISOString();
}

async function createSupabaseFromCookies() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          cookieStore.set({ name, value: "", ...options });
        },
      },
    }
  );
}

// ✅ profiles は cookie付き supabase で取る（無ければ作る）
// ✅ 方針：profiles.id = auth.uid() に統一する
async function getOrCreateProfile(
  supabase: Awaited<ReturnType<typeof createSupabaseFromCookies>>,
  authUserId: string
) {
  // まず id で探す（= auth.uid と一致する前提）
  const { data: existing, error: selErr } = await supabase
    .from("profiles")
    .select("id, plan, meta_balance")
    .eq("id", authUserId)
    .maybeSingle();

  if (selErr) {
    console.error("profiles select error:", selErr);
    return null;
  }
  if (existing) {
    return existing as { id: string; plan: Plan | null; meta_balance: number | null };
  }

  // 無ければ作る（id も auth_user_id も authUserId に揃える）
  const { data: created, error: insErr } = await supabase
    .from("profiles")
    .insert({
      id: authUserId,
      auth_user_id: authUserId,
      plan: "free",
      meta_balance: 0,
    })
    .select("id, plan, meta_balance")
    .single();

  if (insErr) {
    console.error("profiles insert error:", insErr);
    return null;
  }
  return created as { id: string; plan: Plan | null; meta_balance: number | null };
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseFromCookies();

    // ✅ userId は body から受け取らない。cookieセッションで確定。
    const { data: auth, error: authErr } = await supabase.auth.getUser();
    const user = auth?.user ?? null;

    if (authErr || !user?.id) {
      return NextResponse.json(
        { ok: false, error: "unauthorized", message: "ログインが必要です。" },
        { status: 401 }
      );
    }

    const authUserId = user.id;

    const body = await req.json().catch(() => ({}));
    const feature = body.feature as FeatureKey | undefined;

    if (!feature || !(feature in FREE_LIMITS)) {
      return NextResponse.json(
        { ok: false, error: "invalid_request", message: "feature が不正です。" },
        { status: 400 }
      );
    }

    const profile = await getOrCreateProfile(supabase, authUserId);
    if (!profile) {
      return NextResponse.json(
        { ok: false, error: "profile_error", message: "profiles の取得/作成に失敗しました。" },
        { status: 500 }
      );
    }

    const plan: Plan = (profile.plan ?? "free") as Plan;
    const startISO = monthStartISO(new Date());

    // ✅ PROは無制限：ログだけ残す
    if (plan === "pro") {
      const { error: logErr } = await supabase.from("usage_logs").insert({
        // user_id は default auth.uid() があるので省略も可だが、明示で入れてOK
        user_id: authUserId,
        feature,
        used_at: new Date().toISOString(),
      });

      if (logErr) {
        console.error("usage_logs insert error (pro):", logErr);
        return NextResponse.json(
          { ok: false, error: "insert_failed", message: "利用ログの保存に失敗しました。" },
          { status: 500 }
        );
      }
      return NextResponse.json({ ok: true, feature, plan, chargedMeta: 0 });
    }

    // ✅ FREE: 今月の無料枠カウント（used_at 기준）
    const freeLimit = FREE_LIMITS[feature];
    const { count, error: countErr } = await supabase
      .from("usage_logs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", authUserId)
      .eq("feature", feature)
      .gte("used_at", startISO);

    if (countErr) {
      console.error("usage_logs count error:", countErr);
      return NextResponse.json(
        { ok: false, error: "count_failed", message: "利用状況の取得に失敗しました。" },
        { status: 500 }
      );
    }

    const usedThisMonth = count ?? 0;

    // ✅ 無料枠内：メタ消費なし
    if (usedThisMonth < freeLimit) {
      const { error: logErr } = await supabase.from("usage_logs").insert({
        user_id: authUserId,
        feature,
        used_at: new Date().toISOString(),
      });

      if (logErr) {
        console.error("usage_logs insert error (free within):", logErr);
        return NextResponse.json(
          { ok: false, error: "insert_failed", message: "利用ログの保存に失敗しました。" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        ok: true,
        feature,
        plan,
        usedThisMonth: usedThisMonth + 1,
        freeLimit,
        chargedMeta: 0,
      });
    }

    // ✅ 無料枠超過：meta を消費
    const cost = META_COST[feature] ?? 1;
    const balance = Number(profile.meta_balance ?? 0);

    if (balance < cost) {
      return NextResponse.json(
        {
          ok: false,
          error: "insufficient_meta",
          message: "メタが不足しています。購入してください。",
          feature,
          plan,
          required: cost,
          balance,
        },
        { status: 402 }
      );
    }

    // ✅ meta 減算（profiles.id = auth.uid()）
    const { error: updErr } = await supabase
      .from("profiles")
      .update({ meta_balance: balance - cost })
      .eq("id", authUserId);

    if (updErr) {
      console.error("profiles meta_balance update error:", updErr);
      return NextResponse.json(
        { ok: false, error: "meta_update_failed", message: "メタ消費に失敗しました。" },
        { status: 500 }
      );
    }

    // ✅ 利用ログ（課金後）
    const { error: logErr } = await supabase.from("usage_logs").insert({
      user_id: authUserId,
      feature,
      used_at: new Date().toISOString(),
    });

    if (logErr) {
      console.error("usage_logs insert error (charged):", logErr);
      return NextResponse.json(
        { ok: false, error: "insert_failed", message: "利用ログの保存に失敗しました。" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      feature,
      plan,
      usedThisMonth: usedThisMonth + 1,
      freeLimit,
      chargedMeta: cost,
      metaBalanceAfter: balance - cost,
    });
  } catch (e) {
    console.error("usage/consume server_error:", e);
    return NextResponse.json(
      { ok: false, error: "server_error", message: "利用制限チェック中にエラーが発生しました。" },
      { status: 500 }
    );
  }
}
