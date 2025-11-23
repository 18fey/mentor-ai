// lib/supabase-server.ts
import { createClient } from "@supabase/supabase-js";

const url =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  throw new Error("Supabase URL or SERVICE_ROLE_KEY is not set");
}

// ✅ サーバー専用クライアント（Service Role）
//   - RLS 無視して読み書きできる
//   - 将来 Auth を使うときは「認証用クライアント」を別で作るイメージ
export const supabaseServer = createClient(url, serviceRoleKey, {
  auth: {
    persistSession: false,
  },
});
