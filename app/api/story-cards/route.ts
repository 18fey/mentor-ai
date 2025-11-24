// app/api/story-cards/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

const DEFAULT_USER_ID = "demo-user";

// ======================
// GET /api/story-cards?userId=xxx
// ======================
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId") ?? DEFAULT_USER_ID;

    const { data, error } = await supabaseServer
      .from("story_cards")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[story-cards] GET error:", error);
      return NextResponse.json(
        { error: "story_cards_fetch_failed", storyCards: [] },
        { status: 500 }
      );
    }

    return NextResponse.json({
      storyCards: data ?? [],
    });
  } catch (e) {
    console.error("[story-cards] GET exception:", e);
    return NextResponse.json(
      { error: "story_cards_fetch_failed", storyCards: [] },
      { status: 500 }
    );
  }
}

// ======================
// POST /api/story-cards
// body: { userId, sessionId, title, topicType, star, learnings, axes, isSensitive }
// ======================
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const star = body.star ?? {};

    const insertRow = {
      user_id: body.userId ?? DEFAULT_USER_ID,
      session_id: body.sessionId ?? null,
      topic_type: body.topicType ?? null, // "gakuchika" など
      title: body.title ?? "",
      star_situation: star.situation ?? "",
      star_task: star.task ?? "",
      star_action: star.action ?? "",
      star_result: star.result ?? "",
      learnings: body.learnings ?? "",
      axes: body.axes ?? [], // text[] カラム想定
      is_sensitive: body.isSensitive ?? false,
      last_updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseServer
      .from("story_cards")
      .insert(insertRow)
      .select("*")
      .single();

    if (error) {
      console.error("[story-cards] POST error:", error);
      return NextResponse.json(
        { error: "story_cards_insert_failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({ storyCard: data });
  } catch (e) {
    console.error("[story-cards] POST exception:", e);
    return NextResponse.json(
      { error: "story_cards_insert_failed" },
      { status: 500 }
    );
  }
}
