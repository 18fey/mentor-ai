// supabase/functions/expire_meta_lots/index.ts
// @ts-nocheck

import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js";

serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // 期限切れロット取得
  const { data: lots } = await supabase
    .from("meta_lots")
    .select("id, auth_user_id, remaining")
    .lt("expires_at", new Date().toISOString())
    .gt("remaining", 0);

  for (const lot of lots ?? []) {
    // remaining → 0
    await supabase.from("meta_lots").update({ remaining: 0 }).eq("id", lot.id);

    // キャッシュ減算
    await supabase.rpc("decrement_meta_balance", {
      p_auth_user_id: lot.auth_user_id,
      p_amount: lot.remaining,
    });

    // 監査ログ
    await supabase.from("meta_events").insert({
      auth_user_id: lot.auth_user_id,
      type: "expire",
      amount: lot.remaining,
      lot_id: lot.id,
      reason: "expired_180_days",
    });
  }

  return new Response("ok");
});
