// app/api/data/delete/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }

  const userId = user.id;

  // ここから削除処理（存在しないテーブルはコメントアウトして調整してね）
  const results: any[] = [];

  // ストーリーカード
  results.push(
    await supabase.from("story_cards").delete().eq("user_id", userId)
  );

  // 面接セッション
  results.push(
    await supabase.from("interview_sessions").delete().eq("user_id", userId)
  );

  // ES評価など他の関連テーブル
  // results.push(
  //   await supabase.from("es_evaluations").delete().eq("user_id", userId)
  // );

  // フィードバックテーブルが user_id を持っているなら
  // results.push(
  //   await supabase.from("beta_feedback").delete().eq("user_id", userId)
  // );

  // プロフィール自体も削除（on delete cascade が付いていれば、
  // これだけで他も消える設計でもOK）
  results.push(
    await supabase.from("users_profile").delete().eq("id", userId)
  );

  const errors = results
    .map((r) => r.error)
    .filter((e) => e !== null && e !== undefined);

  if (errors.length > 0) {
    console.error("delete errors:", errors);
    return NextResponse.json(
      { error: "failed to delete some data", detail: errors },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
