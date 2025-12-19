// app/billing/success/page.tsx
"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

function supabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export default function BillingSuccess() {
  const [plan, setPlan] = useState<string>("...");

  useEffect(() => {
    (async () => {
      const sb = supabase();
      const { data: userData } = await sb.auth.getUser();
      const authUserId = userData?.user?.id;

      if (!authUserId) return;

      // profiles.auth_user_idで読む
      const { data } = await sb
        .from("profiles")
        .select("plan")
        .eq("auth_user_id", authUserId)
        .maybeSingle();

      setPlan(data?.plan ?? "free");
    })();
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <h1>決済完了</h1>
      <p>現在のプラン：{plan}</p>
      <a href="/case">ケースへ戻る</a>
    </div>
  );
}
