// app/api/story-cards/from-audio/route.ts
import { NextRequest, NextResponse } from "next/server";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
const TABLE_NAME = "story_cards";

type QA = { question: string; answer: string };

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
    console.error("Supabase story_cards(from-audio) error:", res.status, text);
    throw new Error(text);
  }
  return res;
}

async function callOpenAI(payload: {
  qaList: QA[];
  personaId?: string;
  profile?: any;
}) {
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
        {
          role: "system",
          content: `
あなたは外資コンサル・外銀の面接官です。
与えられた「10問の模擬面接のQ&Aログ」と「候補者プロフィール」から、
就活でそのまま使える「STAR形式のストーリーカード」を1枚だけ作成してください。

出力フォーマットは必ず次のJSONオブジェクト1つにしてください：

{
  "title": "経験のタイトル（20〜40文字程度）",
  "topicType": "gakuchika | self_pr | why_company | why_industry",
  "star": {
    "situation": "...",
    "task": "...",
    "action": "...",
    "result": "..."
  },
  "learnings": "この経験から得た学び・強みを1〜3文で",
  "axes": ["主体性 / オーナーシップ", "チームワーク / 巻き込み力"]
}
          `.trim(),
        },
        {
          role: "user",
          content: JSON.stringify(payload, null, 2),
        },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("OpenAI from-audio error:", res.status, text);
    throw new Error(text);
  }

  const json = await res.json();

  const text = json?.choices?.[0]?.message?.content;
  if (!text || typeof text !== "string") {
    console.error("OpenAI from-audio invalid response:", json);
    throw new Error("invalid OpenAI response");
  }

  try {
    return JSON.parse(text);
  } catch (e) {
    console.error("OpenAI from-audio JSON.parse error:", text);
    throw e;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId, personaId, qaList, profile } = await req.json();

    if (!userId || !Array.isArray(qaList) || qaList.length === 0) {
      return NextResponse.json(
        { error: "userId と qaList は必須です。" },
        { status: 400 }
      );
    }

    // 1. OpenAI でカード生成
    const card = await callOpenAI({
      qaList,
      personaId,
      profile,
    });

    // 2. Supabase に保存
    const row = {
      user_id: userId,
      // 音声版は「session_id なし」で保存する想定（カラムが NOT NULL ならここを修正）
      session_id: null,
      topic_type: card.topicType ?? "gakuchika",
      title: card.title ?? "音声面接から生成したストーリー",
      star_situation: card.star?.situation ?? "",
      star_task: card.star?.task ?? "",
      star_action: card.star?.action ?? "",
      star_result: card.star?.result ?? "",
      learnings: card.learnings ?? "",
      axes: Array.isArray(card.axes) ? card.axes : [],
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
  } catch (e: any) {
    console.error("from-audio POST failed:", e);
    return NextResponse.json(
      { error: "story_card_from_audio_failed", detail: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}
