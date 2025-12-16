// app/api/feedback/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { supabaseServer } from "@/lib/supabase-server";

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

export async function POST(req: Request) {
  try {
    const data = await req.json().catch(() => ({}));

    // ✅ セッションから user 取得（ここが本人判定の唯一の根拠）
    const supabase = await createSupabaseFromCookies();
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user ?? null;
    const authUserId = user?.id ?? null;

    // 1) feedback 保存（Service Roleで確実にinsert）
    const { data: inserted, error: insertError } = await supabaseServer
      .from("beta_feedback")
      .insert({
        rating: data.rating ?? null,
        comment: data.comment ?? null,
        email: data.email ?? null,
        page: data.page ?? null,
        user_id: authUserId,        // ログインしてなければ null
        meta_awarded: false,        // 後で付与したら true に
      })
      .select("id")
      .single();

    if (insertError || !inserted) {
      console.error("[feedback] insert error:", insertError);
      return NextResponse.json({ ok: false, error: "insert_failed" }, { status: 500 });
    }

    // 2) ログインしてる人だけ meta +3（重複付与防止つき）
    if (authUserId) {
      // すでに meta_awarded = true なら何もしない（二重実行対策）
      const { data: fbRow, error: fbReadError } = await supabaseServer
        .from("beta_feedback")
        .select("id, meta_awarded")
        .eq("id", inserted.id)
        .single();

      if (!fbReadError && fbRow && !fbRow.meta_awarded) {
        // profilesで管理している前提
        const { data: prof, error: profErr } = await supabaseServer
          .from("profiles")
          .select("meta_balance")
          
          .single();

        if (profErr) {
          console.error("[feedback] profile read error:", profErr);
        } else {
          const current = prof?.meta_balance ?? 0;

          const { error: profUpdateErr } = await supabaseServer
            .from("profiles")
            .update({ meta_balance: current + 3 })
            .eq("id", authUserId)

          if (profUpdateErr) {
            console.error("[feedback] meta update error:", profUpdateErr);
          } else {
            await supabaseServer
              .from("beta_feedback")
              .update({ meta_awarded: true })
              .eq("id", inserted.id);
          }
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[feedback] route error:", err);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
