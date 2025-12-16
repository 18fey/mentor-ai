// utils/supabase/server.ts
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export function createServerSupabase() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        async get(name: string) {
          return (await cookieStore).get(name)?.value;
        },
        set() {
          // 今回の route では不要（ログイン/更新を扱うなら実装）
        },
        remove() {
          // 同上
        },
      },
    }
  );
}

export type ServerSupabaseClient = ReturnType<typeof createServerSupabase>;
