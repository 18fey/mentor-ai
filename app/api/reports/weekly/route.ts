// app/api/reports/weekly/route.ts
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
    console.error("Supabase weekly error:", res.status, text);
    throw new Error(text);
  }
  return res;
}

// OpenAI Responses API → JSON を返すヘルパー
async function callOpenAiJson(systemPrompt: string, userPrompt: string) {
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      response_format: { type: "json_object" },
      input: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("OpenAI weekly error:", res.status, text);
    throw new Error(text);
  }

  const data = await res.json();
  const raw = (data.output?.[0]?.content?.[0]?.text ?? "{}") as string;

  try {
    return JSON.parse(raw);
  } catch (e) {
    console.error("Failed to parse weekly JSON:", raw);
    return {};
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    // userId = Supabase auth.user.id
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "user_not_authenticated" },
        { status: 401 }
      );
    }

    // 直近7日間
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const from = weekAgo.toISOString();

    // 1. プロフィール取得（auth_user_id 単位）
    const profileRes = await supabaseFetch(
      `users_profile?select=*&auth_user_id=eq.${encodeURIComponent(
        userId
      )}&limit=1`,
      { method: "GET" }
    );
    const profileRows = await profileRes.json();
    const profile = profileRows[0] ?? null;

    // 2. 直近1週間のストーリーカード取得（user_id = auth_user_id）
    const cardsRes = await supabaseFetch(
      `story_cards?select=*&user_id=eq.${encodeURIComponent(
        userId
      )}&created_at=gte.${from}&is_sensitive=eq.false&order=created_at.asc`,
      { method: "GET" }
    );
    const cards = await cardsRes.json();

    // 3. まとめて OpenAI に投げて「週次レポート JSON」を生成
    const systemPrompt = `
あなたは就活のトップメンターです。
与えられた「プロフィール」と「ストーリーカード一覧」から、
1週間分の自己分析レポートを日本語で作成してください。

出力フォーマットは必ず次の JSON にしてください:

{
  "profileSummary": "候補者の全体像を2〜4文で要約",
  "axes": [
    {
      "label": "成長環境",
      "description": "どんなエピソードからこの軸が見えるかを要約",
      "relatedCards": ["カードタイトルA", "カードタイトルB"]
    }
  ],
  "aiComments": {
    "keywords": ["粘り強さ", "巻き込み力"],
    "strengthSummary": "この1週間の強みの傾向",
    "weakPointSummary": "まだ薄い領域や、今後深掘りしたいポイント",
    "nextWeekSuggestions": [
      "失敗体験をテーマに1本ストーリーカードを作ってみましょう。",
      "志望動機（業界）を深掘りするセッションを1回やりましょう。"
    ]
  }
}
`.trim();

    const userPrompt = `
[プロフィール]
${JSON.stringify(profile, null, 2)}

[今週のストーリーカード]
${JSON.stringify(cards, null, 2)}
`.trim();

    const reportJson = await callOpenAiJson(systemPrompt, userPrompt);

    return NextResponse.json({
      profile,
      cards,
      report: reportJson,
      meta: {
        from,
        to: now.toISOString(),
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "weekly_report_failed" },
      { status: 500 }
    );
  }
}
