import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function DELETE() {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const userId = user.id;

  await supabase.from("story_cards").delete().eq("user_id", userId);
  await supabase.from("interview_sessions").delete().eq("user_id", userId);
  await supabase.from("interview_turns").delete().eq("user_id", userId);

  return NextResponse.json({ success: true });
}
