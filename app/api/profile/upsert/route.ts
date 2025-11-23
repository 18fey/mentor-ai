// app/api/profile/upsert/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);

    if (!body) {
      return NextResponse.json(
        { ok: false, error: "invalid_body" },
        { status: 400 }
      );
    }

    const {
      userId,      // ← "18fey" みたいなアプリ側のID
      name,
      university,
      faculty,
      grade,
    } = body as {
      userId?: string;
      name?: string;
      university?: string;
      faculty?: string;
      grade?: string;
    };

    if (!userId) {
      return NextResponse.json(
        {
          ok: false,
          error: "missing_user_id",
          message: "userId は必須です",
        },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Supabase env missing");
      return NextResponse.json(
        { ok: false, error: "env_missing" },
        { status: 500 }
      );
    }

    // すでにあるか確認（auth_user_id = userId の行）
    const checkRes = await fetch(
      `${supabaseUrl}/rest/v1/users_profile?auth_user_id=eq.${encodeURIComponent(
        userId
      )}`,
      {
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
      }
    );

    if (!checkRes.ok) {
      const t = await checkRes.text();
      console.error("Supabase check error:", checkRes.status, t);
      return NextResponse.json(
        { ok: false, error: "supabase_check_error" },
        { status: 500 }
      );
    }

    const existing = await checkRes.json();

    if (Array.isArray(existing) && existing.length > 0) {
      // すでにある → UPDATE（プロフィール編集）
      const updateRes = await fetch(
        `${supabaseUrl}/rest/v1/users_profile?auth_user_id=eq.${encodeURIComponent(
          userId
        )}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
            Prefer: "return=representation",
          },
          body: JSON.stringify({
            name,
            university,
            faculty,
            grade,
            updated_at: new Date().toISOString(),
          }),
        }
      );

      const updated = await updateRes.json().catch(() => null);

      return NextResponse.json(
        { ok: true, mode: "update", profile: updated },
        { status: 200 }
      );
    } else {
      // まだない → INSERT（初回プロフィール作成）
      const insertRes = await fetch(`${supabaseUrl}/rest/v1/users_profile`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          auth_user_id: userId,
          name,
          university,
          faculty,
          grade,
          plan: "free",
          beta_user: false,
        }),
      });

      const inserted = await insertRes.json().catch(() => null);

      return NextResponse.json(
        { ok: true, mode: "insert", profile: inserted },
        { status: 200 }
      );
    }
  } catch (e: any) {
    console.error("Profile upsert error:", e);
    return NextResponse.json(
      { ok: false, error: "server_error", message: e?.message },
      { status: 500 }
    );
  }
}
