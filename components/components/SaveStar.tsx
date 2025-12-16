"use client";

import { useEffect, useState } from "react";

type Props = {
  attemptType: string;
  attemptId: string;
  saveType?: string; // default "result"
};

export function SaveStar({ attemptType, attemptId, saveType = "result" }: Props) {
  const [saved, setSaved] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/saved/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attempt_type: attemptType, attempt_id: attemptId, save_type: saveType }),
      });
      const j = await r.json().catch(() => null);
      if (j?.ok) setSaved(!!j.saved);
    })();
  }, [attemptType, attemptId, saveType]);

  const toggle = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const r = await fetch("/api/saved/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attempt_type: attemptType, attempt_id: attemptId, save_type: saveType }),
      });
      const j = await r.json().catch(() => null);
      if (j?.ok) setSaved(!!j.saved);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className="px-3 py-2 rounded-xl border hover:bg-white/10 transition"
      aria-label="save"
      title={saved ? "保存解除" : "保存"}
    >
      <span className="text-lg">{saved ? "★" : "☆"}</span>
    </button>
  );
}
