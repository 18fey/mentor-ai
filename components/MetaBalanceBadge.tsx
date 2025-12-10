// src/components/MetaBalanceBadge.tsx
"use client";

import React, { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

type ProfileRow = {
  id: string;
  meta_balance: number | null;
};

function createClientSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export const MetaBalanceBadge: React.FC = () => {
  const supabase = createClientSupabase();
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    const fetchBalance = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setBalance(null);
          return;
        }

        const { data, error } = await supabase
          .from("profiles")
          .select("id, meta_balance")
          .eq("id", user.id)
          .maybeSingle<ProfileRow>();

        if (error) {
          console.error("MetaBalanceBadge profile error:", error);
          setBalance(null);
          return;
        }

        setBalance(data?.meta_balance ?? 0);
      } finally {
        setLoading(false);
      }
    };

    fetchBalance();
  }, [supabase]);

  // 未ログインなら何も出さない
  if (!loading && balance === null) {
    return null;
  }

  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-sky-100 bg-sky-50/80 px-3 py-1 text-xs font-medium text-sky-800 shadow-sm">
      <span className="inline-block h-2 w-2 rounded-full bg-sky-500" />
      <span>Meta</span>
      <span className="tabular-nums">{loading ? "…" : balance ?? 0}</span>
    </div>
  );
};
