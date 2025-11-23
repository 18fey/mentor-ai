// app/api/save-insight/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    console.log("[save-insight] request body:", body);

    // とりあえずダミーで 200 を返しておく
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[save-insight] error:", e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
