// app/api/interview/session/start/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAuthUserId } from "@/lib/authServer";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const userId = await requireAuthUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "unauthorized", message: "login required" },
        { status: 401 }
      );
    }

    const { topic, isSensitive = false } = await req.json().catch(() => ({}));

    const row = {
      user_id: userId,
      topic: topic ?? "",
      is_sensitive: !!isSensitive,
    };

    const { data, error } = await supabaseAdmin
      .from("interview_sessions")
      .insert(row)
      .select("id")
      .single();

    if (error || !data) {
      console.error("interview session/start error:", error);
      return NextResponse.json(
        { error: "Failed to create session" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      sessionId: data.id,
      isSensitive: !!isSensitive,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to create session" },
      { status: 500 }
    );
  }
}
