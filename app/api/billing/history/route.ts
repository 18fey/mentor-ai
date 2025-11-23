// app/api/billing/history/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  // TODO: 本番では PAY.JP の Webhook や Supabase の billing テーブルから
  // 実際の履歴を取得して返す。
  // いまは空配列を返すだけ（UI側では「履歴はありません」と表示される）。

  const items: any[] = [];
  return NextResponse.json({ items });
}
