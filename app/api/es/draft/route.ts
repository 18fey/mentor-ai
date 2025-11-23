// app/api/es/draft/route.ts
import { NextRequest, NextResponse } from "next/server";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;

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

async function callOpenAI(card: any) {
  const prompt = `
以下は就活用のSTARカードです。
この内容を基に「400〜600字のESドラフト」を日本語で作成してください。

必ず以下の構成を含めてください：

- 結論（この経験を一言で言うと？）
- S（状況）
- T（課題）
- A（行動）
- R（結果）
- この経験から得た強みと一言まとめ

=== STARカード ===
${JSON.stringify(card, null, 2)}
`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "あなたはES文章を精密に作るプロの添削者です。" },
        { role: "user", content: prompt },
      ],
    }),
  });

  const json = await res.json();
  return json.choices?.[0]?.message?.content ?? "";
}

export async function POST(req: NextRequest) {
  try {
    const { storyCardId } = await req.json();
    if (!storyCardId) {
      return NextResponse.json(
        { error: "storyCardId is required" },
        { status: 400 }
      );
    }

    // 1) Supabase からカードを取得
    const res = await supabaseFetch(
      `story_cards?select=*&id=eq.${storyCardId}&limit=1`,
      { method: "GET" }
    );
    const rows = await res.json();
    const card = rows[0];
    if (!card) {
      return NextResponse.json(
        { error: "story card not found" },
        { status: 404 }
      );
    }

    // 2) OpenAI に投げて ESドラフト生成
    const draft = await callOpenAI(card);

    return NextResponse.json({ draft });
  } catch (e) {
    console.error("/api/es/draft error:", e);
    return NextResponse.json(
      { error: "es_draft_failed" },
      { status: 500 }
    );
  }
}
