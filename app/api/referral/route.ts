// app/api/referral/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

type Database = any;

async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    // ✅ ユーザーセッション前提のAPIは ANON KEY を使う
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

export async function GET() {
  const supabase = await createSupabaseServerClient();

  // ログインユーザー取得
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ ok: false, message: "Not authenticated" }, { status: 401 });
  }

  // プロフィール取得
  let { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, referral_code, meta_balance")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return NextResponse.json({ ok: false, message: "Profile not found" }, { status: 404 });
  }

  // 紹介コードがなければ自動発行
  if (!profile.referral_code) {
    const randomCode = crypto.randomUUID().slice(0, 8).toUpperCase();

    const { data: updatedProfile, error: updateError } = await supabase
      .from("profiles")
      .update({ referral_code: randomCode })
      .eq("id", user.id)
      .select("id, referral_code, meta_balance")
      .single();

    if (updateError || !updatedProfile) {
      return NextResponse.json({ ok: false, message: "Failed to generate referral code" }, { status: 500 });
    }

    profile = updatedProfile;
  }

  // 紹介イベント履歴を取得
  const { data: events } = await supabase
    .from("referral_events")
    .select("created_at, event, rewarded, invitee_user_id")
    .eq("inviter_user_id", profile.id)
    .order("created_at", { ascending: false });

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://mentor.ai";
  const referralLink = `${baseUrl}/signup?ref=${profile.referral_code}`;

  return NextResponse.json({
    ok: true,
    referralCode: profile.referral_code,
    referralLink,
    metaBalance: profile.meta_balance ?? 0,
    events: events ?? [],
  });
}
