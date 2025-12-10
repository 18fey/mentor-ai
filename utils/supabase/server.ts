// utils/supabase/server.ts
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function createServerSupabase() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        // 読み取り専用で OK（ログイン/ログアウトは Supabase の auth 画面で処理）
        set() {
          // 必要になったら middleware 側で実装
        },
        remove() {
          // 同上
        },
      },
    }
  );
}

export type ServerSupabaseClient = Awaited<ReturnType<typeof createServerSupabase>>;
