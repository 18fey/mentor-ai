// app/api/profile/accept-terms/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  // TODO: 本番では Supabase の users_profile を更新して
  // accepted_terms_at / has_accepted_terms を true にする。
  // いまは UI が動くようにダミーで 200 を返すだけ。

  return NextResponse.json({ ok: true });
}
