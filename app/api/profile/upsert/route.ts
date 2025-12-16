// app/api/profile/upsert/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { supabaseServer } from "@/lib/supabase-server";

type Database = any;

export const runtime = "nodejs";

/**
 * ✅ 方針
 * - もう users_profile は触らない
 * - 認証済みユーザーの auth.users.id を profiles.id として一本化
 * - Service Role（supabaseServer）で upsert して確実に書き込む
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as
      | {
          name?: string;
          university?: string;
          faculty?: string;
          grade?: string;
        }
      | null;

    if (!body) {
      return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
    }

    // ✅ セッションから user を確定（クライアントが userId を送るのは禁止）
    const cookieStore = await cookies();
    const supabase = createServerClient<Database>(
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

    const { data: auth, error: authErr } = await supabase.auth.getUser();
    const user = auth?.user ?? null;
    const userId = user?.id ?? null;

    if (authErr || !userId) {
      return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
    }

    const { name, university, faculty, grade } = body;

    // ✅ 空文字は null に寄せたい場合（任意）
    const payload = {
      id: userId, // ★ profiles.id = auth.users.id
      display_name: name ?? null, // ← もしprofiles側が display_name の場合
      affiliation: university ?? null, // ← もしprofiles側が affiliation の場合
      // もし profiles に university/faculty/grade があるなら、下に差し替えてね:
      // university: university ?? null,
      // faculty: faculty ?? null,
      // grade: grade ?? null,
      updated_at: new Date().toISOString(),
    };

    /**
     * ⚠️ 重要
     * あなたのスクショだと profiles は
     * - display_name
     * - affiliation
     * があるっぽい（university/faculty/grade は users_profile 側にあった）
     *
     * なので今は一旦
     * - name -> display_name
     * - university -> affiliation
     * にマッピングしてる。
     *
     * 将来的に profiles に university/faculty/grade カラムを足すなら、上のpayloadを差し替えればOK。
     */

    const { data, error } = await supabaseServer
      .from("profiles")
      .upsert(payload, { onConflict: "id" })
      .select("*")
      .single();

    if (error) {
      console.error("[profile/upsert] upsert error:", error);
      return NextResponse.json({ ok: false, error: "supabase_upsert_failed" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, profile: data }, { status: 200 });
  } catch (e: any) {
    console.error("[profile/upsert] exception:", e);
    return NextResponse.json(
      { ok: false, error: "server_error", message: e?.message },
      { status: 500 }
    );
  }
}
