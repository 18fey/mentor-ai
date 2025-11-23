import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const userId = user.id;

  const { data: storyCards } = await supabase
    .from("story_cards")
    .select("*")
    .eq("user_id", userId);

  const { data: sessions } = await supabase
    .from("interview_sessions")
    .select("*")
    .eq("user_id", userId);

  return NextResponse.json({
    storyCards,
    sessions,
  });
}
