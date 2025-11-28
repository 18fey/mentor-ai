// app/api/usage/feature/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);

    // ログだけ出しておく（あとで集計に使いたくなったらここから拡張）
    console.log("usage feature called:", body);

    // 🔹β版では「常にロックしない」で返す
    return NextResponse.json({
      ok: true,
      locked: false,   // ← ここが false ならフロント側は普通に使える
      feature: body?.feature ?? null,
      remaining: null, // 将来「残り◯回」で使いたいとき用
      limit: null,
      message: null,
    });
  } catch (e) {
    console.error("usage feature api error:", e);

    // 失敗しても「ロック扱いにはしない」方針にするなら 200 を返してもOK
    return NextResponse.json(
      {
        ok: false,
        locked: false,
        error: "internal_error",
        message: "usage api error",
      },
      { status: 200 }
    );
  }
}
