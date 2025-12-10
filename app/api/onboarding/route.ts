// app/api/onboarding/route.ts
import { NextResponse } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

type RequestBody = {
  authUserId?: string | null;
  agreed?: boolean;
  planType?: string;
  contact?: string | null;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RequestBody;

    const authUserId = body.authUserId;
    if (!authUserId) {
      return NextResponse.json(
        { ok: false, message: "auth user id is required" },
        { status: 400 }
      );
    }

    // 規約チェックはデフォルト true（同意前提）
    const agreed = body.agreed ?? true;
    const planType = body.planType ?? "beta_free";
    const contact = body.contact ?? null;

    // β登録・規約同意を管理するテーブル：users_profile
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/users_profile?id=eq.${encodeURIComponent(
        authUserId
      )}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          agreed_terms: agreed,
          agreed_terms_at: new Date().toISOString(),
          plan_type: planType,
          beta_user: true,
          contact_optional: contact,
        }),
      }
    );

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("onboarding supabase error:", res.status, text);
      return NextResponse.json(
        { ok: false, message: "failed to update users_profile" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("onboarding route error:", e);
    return NextResponse.json(
      { ok: false, message: "internal error" },
      { status: 500 }
    );
  }
}
