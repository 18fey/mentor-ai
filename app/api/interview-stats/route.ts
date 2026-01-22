// app/api/interview-stats/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

type Database = any;

async function createSupabaseFromCookies() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
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
  const supabase = await createSupabaseFromCookies();

  const { data: auth, error: authErr } = await supabase.auth.getUser();
  const user = auth?.user ?? null;
  if (authErr || !user?.id) {
    return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
  }
  const userId = user.id;

  // 1) 模擬面接回数
  const { count: sessionCount, error: cErr } = await supabase
    .from("interview_sessions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  if (cErr) {
    return NextResponse.json({ ok: false, error: "db_error", message: cErr.message }, { status: 500 });
  }

  // 2) 平均評価（0-100）
  // ※ interview_logs に score(int) を入れてる前提
  const { data: scores, error: sErr } = await supabase
    .from("interview_logs")
    .select("score")
    .eq("user_id", userId);

  if (sErr) {
    return NextResponse.json({ ok: false, error: "db_error", message: sErr.message }, { status: 500 });
  }

  const arr = (scores ?? []).map((x: any) => Number(x.score)).filter((n) => Number.isFinite(n));
  const avg100 = arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

  // 5点換算（例：80点→4.0）
  const avg5 = avg100 == null ? null : Math.round((avg100 / 20) * 10) / 10;

  // 3) 累計練習時間（今は null 返す or 仮計算）
  // 後で duration_sec を保存するようにしたらここでSUMできる
  const totalPracticeSec = null;

  return NextResponse.json({
    ok: true,
    sessionCount: sessionCount ?? 0,
    avgScore100: avg100 == null ? null : Math.round(avg100),
    avgScore5: avg5,
    totalPracticeSec,
  });
}
