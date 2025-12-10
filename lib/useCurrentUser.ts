// hooks/useCurrentUser.ts など
"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

const createBrowserSupabaseClient = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

type BrowserSupabaseClient = ReturnType<typeof createBrowserSupabaseClient>;

export function useCurrentUser() {
  const [userId, setUserId] = useState<string | null>(null);
  const [supabase] = useState<BrowserSupabaseClient>(() =>
    createBrowserSupabaseClient()
  );

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });
  }, [supabase]);

  return userId;
}
