// app/api/story-cards/from-audio/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { TopicType } from "@/lib/types/story";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type QA = { question: string; answer: string };

const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
if (!OPENAI_API_KEY) {
  console.warn("❗ OPENAI_API_KEY が設定されていません。.env.local を確認してください。");
}

// TopicType ガード
const isValidTopicType = (v: unknown): v is TopicType => {
  return (
    v === "gakuchika" ||
    v === "self_pr" ||
    v === "why_company" ||
    v === "why_industry" ||
    v === "general"
  );
};

type OpenAIPayload = {
  qaList: QA[];
  personaId?: string;
  profile?: any;
  topicType?: TopicType;
};

type OpenAICard = {
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

async function callOpenAI(payload: OpenAIPayload): Promise<OpenAICard> {
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

※ リクエストに "topicType" が含まれている場合は、その種類
   ("gakuchika" | "self_pr" | "why_company" | "why_industry" | "general")
   を最優先の分類候補として扱ってください。

出力フォーマットは必ず次のJSONオブジェクト1つにしてください：

{
  "title": "経験のタイトル（20〜40文字程度）",
  "topicType": "gakuchika | self_pr | why_company | why_industry | general",
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
        { role: "user", content: JSON.stringify(payload, null, 2) },
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
    return JSON.parse(text) as OpenAICard;
  } catch (e) {
    console.error("OpenAI from-audio JSON.parse error:", text);
    throw e;
  }
}

async function createSupabaseFromCookies() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          cookieStore.set({ name, value: "", ...options });
        },
      },
    }
  );
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseFromCookies();

    // ✅ userIdは body から受け取らない。cookie auth で確定。
    const { data: auth, error: authErr } = await supabase.auth.getUser();
    const user = auth?.user ?? null;

    if (authErr || !user?.id) {
      return NextResponse.json(
        { error: "unauthorized", message: "ログインが必要です。" },
        { status: 401 }
      );
    }

    const authUserId = user.id;

    const body = await req.json().catch(() => ({}));

    const {
      personaId,
      qaList,
      profile,
      topicType, // 任意
      isSensitive,
      sessionId,
    } = body ?? {};

    if (!Array.isArray(qaList) || qaList.length === 0) {
      return NextResponse.json(
        { error: "bad_request", message: "qaList は必須です。" },
        { status: 400 }
      );
    }

    // 1) OpenAIでカード生成
    const card = await callOpenAI({
      qaList,
      personaId,
      profile,
      topicType: isValidTopicType(topicType) ? topicType : undefined,
    });

    // 2) TopicType確定（優先: リクエスト > OpenAI返却 > デフォルト）
    let effectiveTopicType: TopicType = "gakuchika";

    if (isValidTopicType(topicType)) effectiveTopicType = topicType;
    else if (isValidTopicType(card.topicType)) effectiveTopicType = card.topicType;

    // 3) Supabaseへ保存（RLSに従う）
    const row = {
      user_id: authUserId,
      session_id: sessionId ?? null,
      topic_type: effectiveTopicType,
      title: card.title ?? "音声面接から生成したストーリー",
      star_situation: card.star?.situation ?? "",
      star_task: card.star?.task ?? "",
      star_action: card.star?.action ?? "",
      star_result: card.star?.result ?? "",
      learnings: card.learnings ?? "",
      axes: Array.isArray(card.axes) ? card.axes : [],
      is_sensitive: !!isSensitive,
      last_updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("story_cards")
      .insert(row)
      .select("*")
      .single();

    if (error) {
      console.error("Supabase story_cards(from-audio) insert error:", error);
      return NextResponse.json(
        {
          error: "story_card_insert_failed",
          detail: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ storyCard: data });
  } catch (e: any) {
    console.error("from-audio POST failed:", e);
    return NextResponse.json(
      {
        error: "story_card_from_audio_failed",
        detail: String(e?.message ?? e),
      },
      { status: 500 }
    );
  }
}
