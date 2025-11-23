// app/api/interview/session/start/route.ts
import { NextRequest, NextResponse } from "next/server";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

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
    console.error("Supabase session/start error:", res.status, text);
    throw new Error(text);
  }
  return res;
}

export async function POST(req: NextRequest) {
  try {
    const { userId, topic, isSensitive = false } = await req.json();

    // topic は「一般面接」「コンサル向け」などなければ空文字でOK
    const row = {
      user_id: userId ?? null,
      topic: topic ?? "",
      is_sensitive: isSensitive,
    };

    const res = await supabaseFetch("interview_sessions", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify([row]),
    });

    const data = await res.json();
    const session = Array.isArray(data) ? data[0] : data;

    return NextResponse.json({
      sessionId: session.id,
      isSensitive,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to create session" },
      { status: 500 }
    );
  }
}
