import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

type StoryCardRow = {
  id: string;
  user_id: string;
  session_id: string | null;
  title: string;
  type: string;
  star: any;
  learnings: string | null;
  axes_link: string[] | null;
  is_sensitive: boolean | null;
  created_at: string;
  last_updated_at: string;
};

// 今は userId を query/body で渡す。
// 将来は「profile.ensure で作ったユーザーID + Auth の user.id」で統一する想定。
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
        { error: "story_cards_fetch_failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      storyCards: (data ?? []) as StoryCardRow[],
    });
  } catch (e) {
    console.error("[story-cards] GET exception:", e);
    return NextResponse.json(
      { error: "story_cards_fetch_failed" },
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

    const row = {
      user_id: body.userId ?? DEFAULT_USER_ID,
      session_id: body.sessionId ?? null,
      title: body.title,
      type: body.topicType,
      star: body.star, // { situation, task, action, result } そのまま jsonb で保存
      learnings: body.learnings ?? "",
      axes_link: body.axes ?? [],
      is_sensitive: body.isSensitive ?? false,
      last_updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseServer
      .from("story_cards")
      .insert(row)
      .select("*")
      .single<StoryCardRow>();

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
