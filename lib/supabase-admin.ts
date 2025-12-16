// lib/supabase-admin.ts
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!url || !serviceRoleKey) {
  throw new Error("Supabase URL or SERVICE_ROLE_KEY is not set");
}

// ✅ 管理者クライアント（RLSを基本バイパス）
export const supabaseAdmin = createClient(url, serviceRoleKey, {
  auth: { persistSession: false },
});
