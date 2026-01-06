// app/api/ai-typing/complete/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { supabaseServer } from "@/lib/supabase-server";

type Database = any;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function createSupabaseFromCookies() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
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

export async function POST() {
  try {
    // 1) セッションから auth.users.id を確定
    const supabase = await createSupabaseFromCookies();
    const { data: auth, error: authErr } = await supabase.auth.getUser();
    const user = auth?.user ?? null;

    if (authErr || !user?.id) {
      return NextResponse.json(
        { ok: false, error: "not_authenticated" },
        { status: 401 }
      );
    }

    const authUserId = user.id;

    // 2) profiles を Service Role で読む（auth_user_id で一致させる）
    const { data: profile, error: profileErr } = await supabaseServer
      .from("profiles")
      .select("id, onboarding_completed, referred_by")
      .eq("id", user.id) 
      .single();

    if (profileErr || !profile) {
      console.error("[ai-typing/complete] profile read error:", profileErr);
      return NextResponse.json(
        { ok: false, error: "profile_not_found" },
        { status: 404 }
      );
    }

    // 3) 多重実行対策：すでに完了ならOK
    if (profile.onboarding_completed) {
      return NextResponse.json({ ok: true, already: true });
    }

    // 4) 完了フラグを立てる
    const { error: markErr } = await supabaseServer
      .from("profiles")
      .update({ onboarding_completed: true })
      .eq("id", user.id) ;

    if (markErr) {
      console.error("[ai-typing/complete] mark completed error:", markErr);
      return NextResponse.json(
        { ok: false, error: "mark_failed" },
        { status: 500 }
      );
    }

    // 5) 紹介処理（referred_by が入ってたら）
    const referredBy = profile.referred_by;
    if (!referredBy) {
      return NextResponse.json({ ok: true });
    }

    // inviter を referral_code から探す
    const { data: inviter, error: inviterErr } = await supabaseServer
      .from("profiles")
      .select("id, meta_balance")
      .eq("referral_code", referredBy)
      .maybeSingle();

    if (inviterErr) {
      console.error("[ai-typing/complete] inviter read error:", inviterErr);
      return NextResponse.json({ ok: true });
    }
    if (!inviter) return NextResponse.json({ ok: true });

    // 6) 重複付与防止：同一 invitee + event があるか
    const EVENT = "ai_typing_completed";

    const { data: existing, error: exErr } = await supabaseServer
      .from("referral_events")
      .select("id")
      .eq("inviter_user_id", inviter.id)
      .eq("invitee_user_id", authUserId)
      .eq("event", EVENT)
      .maybeSingle();

    if (exErr) {
      console.error("[ai-typing/complete] referral_events check error:", exErr);
      return NextResponse.json({ ok: true });
    }

    if (!existing) {
      const { error: evErr } = await supabaseServer
        .from("referral_events")
        .insert({
          inviter_user_id: inviter.id,
          invitee_user_id: authUserId,
          event: EVENT,
          rewarded: true,
        });

      if (evErr) {
        console.error("[ai-typing/complete] referral event insert error:", evErr);
        return NextResponse.json({ ok: true });
      }

      const current = inviter.meta_balance ?? 0;
      const { error: metaErr } = await supabaseServer
        .from("profiles")
        .update({ meta_balance: current + 5 })
        .eq("id", inviter.id);

      if (metaErr) {
        console.error("[ai-typing/complete] meta add error:", metaErr);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[ai-typing/complete] exception:", e);
    return NextResponse.json(
      { ok: false, error: "server_error" },
      { status: 500 }
    );
  }
}
