// app/api/auth/login/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
// Database 型を定義していなければ <any> でOK
// import type { Database } from "@/lib/database.types";

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

export async function POST(req: Request) {
  // ★ ここがポイント：Cookie と紐づいた Supabase クライアントを作る
  const supabase = createRouteHandlerClient<any>({ cookies });

  const { email, password } = await req.json();

  if (!email || !password) {
    return NextResponse.json(
      { error: "メールアドレスとパスワードを入力してください。" },
      { status: 400 }
    );
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const now = new Date();

  // 1) ロック中か確認
  const { data: attempt } = await supabase
    .from("login_attempts")
    .select("*")
    .eq("email", normalizedEmail)
    .maybeSingle(); // single だと行が無い時に error になるので maybeSingle が安心

  if (attempt?.locked_until && new Date(attempt.locked_until) > now) {
    const minutesLeft = Math.ceil(
      (new Date(attempt.locked_until).getTime() - now.getTime()) / 60000
    );
    return NextResponse.json(
      {
        error: `ログイン試行が一定回数を超えたため、${minutesLeft}分後までアカウントが一時的にロックされています。`
      },
      { status: 429 }
    );
  }

  // 2) Supabase Authでログイン試行
  const {
    data: { session },
    error
  } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password
  });

  if (error || !session) {
    // 失敗時：カウントアップ
    const failedAttempts = (attempt?.failed_attempts ?? 0) + 1;

    let lockedUntil: Date | null = null;
    if (failedAttempts >= MAX_FAILED) {
      lockedUntil = new Date(now.getTime() + LOCK_MINUTES * 60 * 1000);
    }

    await supabase.from("login_attempts").upsert({
      email: normalizedEmail,
      failed_attempts: failedAttempts,
      locked_until: lockedUntil
    });

    return NextResponse.json(
      {
        error:
          failedAttempts >= MAX_FAILED
            ? `ログインに${MAX_FAILED}回以上失敗したため、${LOCK_MINUTES}分間ロックされました。時間をおいて再度お試しください。`
            : "メールアドレスまたはパスワードが正しくありません。"
      },
      { status: 401 }
    );
  }

  // 3) 成功時：カウンターリセット
  if (attempt) {
    await supabase.from("login_attempts").delete().eq("email", normalizedEmail);
  }

  // ★ ここで auth-helpers が Cookie にセッションを書き込んでくれる
  return NextResponse.json({ success: true });
}
