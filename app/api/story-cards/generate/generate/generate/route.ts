// app/api/story-cards/generate/route.ts
import { NextRequest, NextResponse } from "next/server";
import type { TopicType } from "@/lib/types/story";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
const TABLE_NAME = "story_cards";

const isValidTopicType = (v: unknown): v is TopicType => {
  return (
    v === "gakuchika" ||
    v === "self_pr" ||
    v === "why_company" ||
    v === "why_industry" ||
    v === "general"
  );
};

async function supabaseFetch(path: string, init: RequestInit = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const headers = {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    "Content-Type": "application/json",
    ...(init.headers || {}),
  };

  const res = await fetch(url, { ...init, headers });
  if (!res.ok) {
    const text = await res.text();
    console.error("Supabase error:", res.status, text);
    throw new Error(text);
  }
  return res;
}

type GeneratedCard = {
  title?: string;
  topicType?: TopicType | string;
  star?: {
    situation?: string;
    task?: string;
    action?: string;
    result?: string;
  };
  learnings?: string;
  axes?: string[];
};

async function callOpenAI(
  systemPrompt: string,
  userPrompt: string
): Promise<GeneratedCard> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("OpenAI story_cards/generate error:", res.status, text);
    throw new Error(text);
  }

  const json = await res.json();
  const text = json?.choices?.[0]?.message?.content as string | undefined;

  if (!text || typeof text !== "string") {
    console.error("OpenAI story_cards/generate invalid response:", json);
    throw new Error("invalid OpenAI response");
  }

  try {
    return JSON.parse(text) as GeneratedCard;
  } catch (e) {
    console.error("OpenAI story_cards/generate JSON.parse error:", text);
    throw e;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { sessionId, userId } = await req.json();

    if (!sessionId || !userId) {
      return NextResponse.json(
        { error: "sessionId and userId are required" },
        { status: 400 }
      );
    }

    // 0. セッションから is_sensitive を取得
    let isSensitive = false;
    try {
      const sessionRes = await supabaseFetch(
        `interview_sessions?select=is_sensitive&id=eq.${encodeURIComponent(
          sessionId
        )}&limit=1`,
        { method: "GET" }
      );
      const sessionRows = await sessionRes.json();
      if (Array.isArray(sessionRows) && sessionRows[0]) {
        isSensitive = !!sessionRows[0].is_sensitive;
      }
    } catch (e) {
      console.warn("Failed to fetch session for is_sensitive:", e);
    }

    // 1. そのセッションの Q&A ログを取得
    const turnsRes = await supabaseFetch(
      `interview_turns?select=role,content,depth_level,created_at&session_id=eq.${encodeURIComponent(
        sessionId
      )}&order=created_at.asc`
    );
    const turns = await turnsRes.json();

    const qaText = (turns as any[])
      .map((t) => `${t.role === "ai" ? "質問" : "回答"}: ${t.content}`)
      .join("\n");

    if (!qaText) {
      return NextResponse.json(
        { error: "このセッションにはQ&Aログがありません。" },
        { status: 400 }
      );
    }

    // 2. OpenAI に STAR カード生成を依頼
    const systemPrompt = `
あなたは外銀・コンサルの面接官です。
以下のQ&Aログから、就活でそのまま使える「STAR形式のストーリーカード」を1枚作成してください。

topicType は、次のいずれかを想定しています：
- "gakuchika"（学生時代に力を入れたこと）
- "self_pr"（自己PR）
- "why_company"（志望動機：企業）
- "why_industry"（志望動機：業界）
- どれにも当てはまらなければ "general"

出力は必ず次のJSON形式にしてください:

{
  "title": "経験のタイトル",
  "topicType": "gakuchika | self_pr | why_company | why_industry | general",
  "star": {
    "situation": "...",
    "task": "...",
    "action": "...",
    "result": "..."
  },
  "learnings": "この経験から得た学び・強みを1〜3文で",
  "axes": ["成長環境", "オーナーシップ"]
}
    `.trim();

    const card = await callOpenAI(systemPrompt, qaText);

    let topicType: TopicType = "general";
    if (isValidTopicType(card.topicType)) {
      topicType = card.topicType;
    }

    const axes: string[] = Array.isArray(card.axes) ? card.axes : [];

    const row = {
      user_id: userId,
      session_id: sessionId,
      is_sensitive: isSensitive,
      topic_type: topicType,
      title: card.title ?? "面接セッションから生成したストーリー",
      star_situation: card.star?.situation ?? "",
      star_task: card.star?.task ?? "",
      star_action: card.star?.action ?? "",
      star_result: card.star?.result ?? "",
      learnings: card.learnings ?? "",
      axes,
      last_updated_at: new Date().toISOString(),
    };

    const res = await supabaseFetch(TABLE_NAME, {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify([row]),
    });

    const data = await res.json();
    const storyCard = Array.isArray(data) ? data[0] : data;

    return NextResponse.json({ storyCard });
  } catch (e) {
    console.error("[story-cards/generate] POST failed:", e);
    return NextResponse.json(
      { error: "story_card_generate_failed" },
      { status: 500 }
    );
  }
}
