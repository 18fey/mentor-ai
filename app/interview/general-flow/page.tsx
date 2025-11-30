// app/interview/general-flow/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

type Database = any;

type Message = { role: "ai" | "user"; content: string };

export default function GeneralFlowPage() {
  const router = useRouter();
  const supabase = createClientComponentClient<Database>();

  const [userId, setUserId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [topic, setTopic] = useState("gakuchika");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [tips, setTips] = useState("");

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

  async function startSession() {
    if (!userId) {
      router.push("/auth");
      return;
    }

    const res = await fetch("/api/interview/session", {
      method: "POST",
      body: JSON.stringify({ userId, topic }),
    });
    const json = await res.json();

    const id = json.session.id as string;
    setSessionId(id);

    // 最初の質問を取得
    const res2 = await fetch("/api/interview/turn", {
      method: "POST",
      body: JSON.stringify({ sessionId: id }),
    });
    const data2 = await res2.json();
    setMessages([{ role: "ai", content: data2.aiTurn.content }]);
    setTips(data2.meta?.tips ?? "");
  }

  async function sendAnswer() {
    if (!sessionId || !input.trim()) return;

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
    setTips(data.meta?.tips ?? "");
    setInput("");
  }

  async function finishSession() {
    if (!sessionId || !userId) return;

    const res = await fetch("/api/story-cards/generate", {
      method: "POST",
      body: JSON.stringify({ sessionId, userId }),
    });
    const data = await res.json();

    if (!res.ok || !data.storyCard) {
      alert(
        data.error ||
          "ストーリーカードの保存に失敗しました。時間をおいて再度お試しください。"
      );
      return;
    }

    alert("ストーリーカードを保存しました: " + data.storyCard.title);
  }

  return (
    <div className="max-w-4xl mx-auto p-8 space-y-6">
      <h1 className="text-2xl font-bold mb-2">
        一般面接AI フルフロー（デバッグ用）
      </h1>

      {/* ステップ1: テーマ & セッション開始 */}
      <div className="flex items-center gap-4">
        <select
          className="border p-2"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
        >
          <option value="gakuchika">ガクチカ</option>
          <option value="self_intro">自己紹介</option>
          <option value="why_industry">志望動機（業界）</option>
          <option value="why_company">志望動機（企業）</option>
        </select>
        <button
          onClick={startSession}
          className="bg-black text-white px-4 py-2 rounded"
          disabled={!authChecked || !userId}
        >
          セッション開始
        </button>
        {sessionId && (
          <span className="text-xs text-gray-500">
            sessionId: {sessionId}
          </span>
        )}
      </div>

      {/* チャットエリア */}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 border rounded p-4 h-96 overflow-y-auto bg-white/70">
          {messages.map((m, i) => (
            <div key={i} className="mb-3">
              <span className="font-semibold">
                {m.role === "ai" ? "🧑‍💼 AI" : "🙋‍♀️ You"}:
              </span>{" "}
              <span>{m.content}</span>
            </div>
          ))}
          {messages.length === 0 && (
            <div className="text-gray-400 text-sm">
              「セッション開始」を押すと質問が表示されます。
            </div>
          )}
        </div>

        {/* ヒント & コントロール */}
        <div className="col-span-1 space-y-3">
          <div className="border rounded p-3 bg-white/70 text-sm">
            <div className="font-semibold mb-1">回答のヒント</div>
            <div className="text-gray-700 whitespace-pre-wrap">
              {tips || "ここにSTARや深掘りのヒントが表示されます。"}
            </div>
          </div>

          <textarea
            className="border p-2 w-full h-24 text-sm"
            placeholder="ここに回答を入力"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />

          <div className="flex gap-2">
            <button
              onClick={sendAnswer}
              className="flex-1 bg-blue-600 text-white px-3 py-2 rounded text-sm"
            >
              回答を送信
            </button>
            <button
              onClick={finishSession}
              className="bg-green-600 text-white px-3 py-2 rounded text-sm"
              disabled={!sessionId || !userId}
            >
              セッション終了
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
