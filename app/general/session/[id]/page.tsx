"use client";
import { useState } from "react";
import { useParams } from "next/navigation";

export default function SessionPage() {
  const { id: sessionId } = useParams();
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");

  async function send() {
    const res = await fetch("/api/interview/turn", {
      method: "POST",
      body: JSON.stringify({
        sessionId,
        userAnswer: input,
      }),
    });

    const data = await res.json();

    setMessages((prev) => [
      ...prev,
      { role: "user", content: input },
      { role: "ai", content: data.aiTurn.content },
    ]);

    setInput("");
  }

  async function finish() {
    const res = await fetch("/api/story-cards/generate", {
      method: "POST",
      body: JSON.stringify({
        sessionId,
        userId: "demo-user",
      }),
    });
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

      <button className="bg-green-600 text-white px-4 py-2" onClick={finish}>
        セッション終了（カード作成）
      </button>
    </div>
  );
}