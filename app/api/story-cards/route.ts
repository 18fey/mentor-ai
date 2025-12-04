// app/api/story-cards/route.ts
import { NextRequest, NextResponse } from "next/server";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const TABLE_NAME = "story_cards";

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
    console.error("Supabase story_cards error:", res.status, text);
    throw new Error(text);
  }
  return res;
}

/**
 * ✅ ストーリーカード一覧取得（GET）
 * /api/story-cards?userId=xxx
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "userId は必須です" },
        { status: 400 }
      );
    }

    const res = await supabaseFetch(
      `${TABLE_NAME}?user_id=eq.${encodeURIComponent(
        userId
      )}&order=last_updated_at.desc`
    );

    const data = await res.json();
    return NextResponse.json({ storyCards: data });
  } catch (e: any) {
    console.error("GET story-cards failed:", e);
    return NextResponse.json(
      { error: "story_cards_fetch_failed" },
      { status: 500 }
    );
  }
}

/**
 * ✅ 既存の POST は別ファイル（generate / from-audio）で定義
 */
