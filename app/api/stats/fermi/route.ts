// app/api/stats/fermi/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

function avg(nums: number[]) {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export async function GET() {
  const supabase = await createSupabaseFromCookies();

  const { data: auth, error: authErr } = await supabase.auth.getUser();
  const user = auth?.user ?? null;
  if (authErr || !user?.id) {
    return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
  }
  const userId = user.id;

  // 解いた数 & 平均（total_score）
  const { count, error: countErr } = await supabase
    .from("fermi_sessions")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  if (countErr) return NextResponse.json({ ok: false, error: "db_error" }, { status: 500 });

  const { data: rows, error: rowsErr } = await supabase
    .from("fermi_sessions")
    .select("total_score, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (rowsErr) return NextResponse.json({ ok: false, error: "db_error" }, { status: 500 });

  const scores = (rows ?? []).map((r: any) => Number(r.total_score ?? 0));
  const solved = Number(count ?? scores.length);
  const averageScore = Math.round(avg(scores));

  // 成長度：初期10件平均 vs 直近10件平均（ない場合は0）
  const first = scores.slice(0, 10);
  const last = scores.slice(Math.max(0, scores.length - 10));
  const growth = Math.round(avg(last) - avg(first));

  return NextResponse.json({
    ok: true,
    solved,
    averageScore,
    growth,
  });
}
