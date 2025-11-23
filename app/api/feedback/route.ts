// app/api/feedback/route.ts
import { NextResponse } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(req: Request) {
  try {
    const data = await req.json();

    // Supabase REST API に直接 POST
    const res = await fetch(`${SUPABASE_URL}/rest/v1/beta_feedback`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify([
        {
          rating: data.rating ?? null,
          comment: data.comment ?? null,
          email: data.email ?? null,
          page: data.page ?? null,
        },
      ]),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("Supabase REST error:", res.status, text);
      return NextResponse.json({ ok: false }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("feedback route error:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
