// app/session/[id]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

export default function SessionPage() {
  const { id: sessionId } = useParams();
  const router = useRouter();

  // ✅ 新SDK：createBrowserClient をそのまま使用
  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  const [userId, setUserId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");

  // ✅ ログインユーザー取得
  useEffect(() => {
    const run = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/auth");
        return;
      }

      setUserId(user.id);
      setAuthChecked(true);
    };
    run();
  }, [supabase, router]);

  async function send() {
    if (!input.trim()) return;

    const res = await fetch("/api/interview/turn", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: String(sessionId),
        userAnswer: input,
      }),
    });

    const data = await res.json();

    setMessages((prev) => [
      ...prev,
      { role: "user", content: input },
      { role: "ai", content: data.aiTurn?.content ?? "" },
    ]);

    setInput("");
  }

  async function finish() {
    if (!userId) {
      router.push("/auth");
      return;
    }

    const res = await fetch("/api/story-cards/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: String(sessionId),
        userId, // ✅ ログインユーザー単位でカード生成
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(
        data.error ||
          "ストーリーカードの作成に失敗しました。時間をおいて再度お試しください。"
      );
      return;
    }

    alert("ストーリーカードを作成しました！");
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="font-bold text-xl mb-4">
        セッション（ID: {String(sessionId)})
      </h1>

      <div className="border p-4 h-96 overflow-y-auto mb-4">
        {messages.map((m, i) => (
          <div key={i} className="mb-3">
            <b>{m.role === "ai" ? "🧑‍💼 AI" : "🙋‍♀️ You"}:</b> {m.content}
          </div>
        ))}
      </div>

      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        className="border p-2 w-full mb-2"
        placeholder="回答を入力"
      />

      <button className="bg-blue-600 text-white px-4 py-2 mr-2" onClick={send}>
        送信
      </button>

      <button
        className="bg-green-600 text-white px-4 py-2"
        onClick={finish}
        disabled={!authChecked || !userId}
      >
        セッション終了（カード作成）
      </button>
    </div>
  );
}
