// app/api/interview/turn/route.ts
import { NextRequest, NextResponse } from "next/server";

// =======================
// Supabase REST ヘルパー
// =======================
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function supabaseFetch(path: string, init: RequestInit) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const headers = {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    ...init.headers,
  };

  const res = await fetch(url, { ...init, headers });

  if (!res.ok) {
    const text = await res.text();
    console.error("Supabase error:", res.status, text);
    throw new Error(text);
  }

  return res;
}

// =======================
// OpenAI Responses ヘルパー
// =======================
const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

async function callOpenAiJson(params: {
  systemPrompt: string;
  userPrompt: string;
}) {
  const res = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      input: [
        { role: "system", content: params.systemPrompt },
        { role: "user", content: params.userPrompt },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("OpenAI error:", res.status, text);
    throw new Error(text);
  }

  const data = await res.json();

  // Responses API の JSON 形式:
  // data.output[0].content[0].text にモデルの返答が入る
  const raw = (data.output?.[0]?.content?.[0]?.text ?? "{}") as string;

  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    console.error("Failed to parse OpenAI JSON:", raw);
    parsed = {};
  }

  return parsed;
}

// =======================
// メインハンドラ
// =======================

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      sessionId,
      userAnswer, // string | null
      depthLevel = 0,
    } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionId is required" },
        { status: 400 }
      );
    }

    // 1. セッション情報取得
    const sessionRes = await supabaseFetch(
      `interview_sessions?select=*&id=eq.${encodeURIComponent(
        sessionId
      )}&limit=1`,
      { method: "GET" }
    );
    const sessionRows = await sessionRes.json();
    const session = sessionRows[0] ?? null;

    if (!session) {
      return NextResponse.json(
        { error: "session not found" },
        { status: 404 }
      );
    }

    // 2. 既存のターン取得
    const turnsRes = await supabaseFetch(
      `interview_turns?select=*&session_id=eq.${encodeURIComponent(
        sessionId
      )}&order=created_at.asc`,
      { method: "GET" }
    );
    const turns: any[] = await turnsRes.json();

    // 3. 今回のユーザー回答を保存
    if (userAnswer) {
      await supabaseFetch("interview_turns", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify([
          {
            session_id: sessionId,
            role: "user",
            content: userAnswer,
            depth_level: depthLevel ?? 0,
          },
        ]),
      });
    }

    // 4. OpenAI に渡すログを組み立て
    const historyText =
      (turns || [])
        .map((t) => `${t.role === "ai" ? "Q" : "A"}: ${t.content}`)
        .join("\n") + (userAnswer ? `\nA: ${userAnswer}` : "");

    const systemPrompt = `
あなたは就活の模擬面接官です。
以下の「面接テーマ」と「これまでのQ&Aログ」を読み、
次にすべき「1つの質問」と、その狙い（タグ）、必要なら回答のヒントをJSONで返してください。

出力フォーマット（必ず JSON のみ）:
{
  "question": "次の質問文",
  "depth_level": 0,
  "tags": ["why", "detail"],
  "helper_hint": "必要なら答え方のヒント"
}
`.trim();

    const userPrompt = `
[面接テーマ]
${session.topic ?? "一般質問"}

[これまでのQ&Aログ]
${historyText || "まだ何もありません。アイスブレイクから始めてください。"}
`.trim();

    // 5. OpenAI から次の質問を取得
    const parsed = await callOpenAiJson({ systemPrompt, userPrompt });

    const question: string =
      typeof parsed.question === "string" && parsed.question.length > 0
        ? parsed.question
        : "この経験について、もう少し具体的に教えてください。";

    const depth_level: number =
      typeof parsed.depth_level === "number" ? parsed.depth_level : 0;

    const tags: string[] = Array.isArray(parsed.tags) ? parsed.tags : [];

    const helper_hint: string | null =
      typeof parsed.helper_hint === "string" ? parsed.helper_hint : null;

    // 6. AI の質問を interview_turns に保存
    const aiInsertRes = await supabaseFetch("interview_turns", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify([
        {
          session_id: sessionId,
          role: "ai",
          content: question,
          depth_level,
          tags,
        },
      ]),
    });

    const inserted = await aiInsertRes.json();
    const aiTurn = Array.isArray(inserted) ? inserted[0] : inserted;

    return NextResponse.json({
      aiTurn,
      helperHint: helper_hint,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "interview_turn_failed" },
      { status: 500 }
    );
  }
}
