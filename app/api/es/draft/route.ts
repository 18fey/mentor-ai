// app/api/es/draft/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;

async function createSupabaseFromCookies() {
  const cookieStore = await cookies();
  return createServerClient<any>(
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

async function callOpenAI(card: any) {
  const prompt = `
以下は就活用のSTARカードです。
この内容を基に「400〜600字のESドラフト」を日本語で作成してください。

必ず以下の構成を含めてください：

- 結論（この経験を一言で言うと？）
- S（状況）
- T（課題）
- A（行動）
- R（結果）
- この経験から得た強みと一言まとめ

=== STARカード ===
${JSON.stringify(card, null, 2)}
`.trim();

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "あなたはES文章を精密に作るプロの添削者です。" },
        { role: "user", content: prompt },
      ],
      temperature: 0.4,
      max_tokens: 900,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("OpenAI draft error:", res.status, text);
    throw new Error("ESドラフト生成でエラーが発生しました。");
  }

  const json = await res.json();
  return json.choices?.[0]?.message?.content ?? "";
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseFromCookies();
    const { data: auth, error: authErr } = await supabase.auth.getUser();
    const user = auth?.user ?? null;

    if (authErr || !user?.id) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { storyCardId } = (await req.json().catch(() => ({}))) as { storyCardId?: string };
    if (!storyCardId) {
      return NextResponse.json({ error: "storyCardId is required" }, { status: 400 });
    }

    // ✅ 自分のカードしか取れない
    const { data: card, error } = await supabase
      .from("story_cards")
      .select("*")
      .eq("id", storyCardId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("story_cards fetch error:", error);
      return NextResponse.json({ error: "story_card_fetch_failed" }, { status: 500 });
    }
    if (!card) {
      return NextResponse.json({ error: "story card not found" }, { status: 404 });
    }

    const draft = await callOpenAI(card);

    // draftもログ残したいなら growth_logs へ
    await supabase.from("growth_logs").insert({
      user_id: user.id,
      source: "es",
      title: "ESドラフト生成",
      description: "STARカードからESドラフトを生成しました。",
      metadata: { story_card_id: storyCardId },
    });

    return NextResponse.json({ draft });
  } catch (e) {
    console.error("/api/es/draft error:", e);
    return NextResponse.json({ error: "es_draft_failed" }, { status: 500 });
  }
}
