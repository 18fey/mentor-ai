// utils/supabase/server-route.ts
// Route Handler（app/api/**）専用の Supabase クライアント
// ★ 注意：service_role キーを使うため絶対にクライアント側では import しない！

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function createRouteSupabase() {
  const cookieStore = await cookies(); // 同期で取得 OK（Route Handler はサーバ側で動く）

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,          // ← URL
    process.env.SUPABASE_SERVICE_ROLE_KEY!,         // ← service_role（強権）
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set() {
          // API 内では Cookie の set/remove は基本発生しない想定
        },
        remove() {},
      },
    }
  );
}

export type RouteSupabaseClient = ReturnType<typeof createRouteSupabase>;
