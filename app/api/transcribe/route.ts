// app/api/transcribe/route.ts
import { NextResponse } from "next/server";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY is not set");
}

// POST /api/transcribe
export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const audio = formData.get("audio");

    if (!audio || !(audio instanceof Blob)) {
      return NextResponse.json(
        { error: "audio file is required" },
        { status: 400 }
      );
    }

    // OpenAI側に送るFormData（重要：フィールド名は file）
    const openaiForm = new FormData();
    // 型的に File 扱いでOK（route handler 内は Web API が使える）
    openaiForm.append("file", audio as any, "recording.webm");
    openaiForm.append("model", "whisper-1");
    openaiForm.append("language", "ja"); // 日本語前提なら指定しておく

    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: openaiForm,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("Whisper API Error:", errText);
      return NextResponse.json(
        {
          error: "Whisper API error",
          detail: errText || undefined,
        },
        { status: 500 }
      );
    }

    const data = (await res.json()) as { text?: string };
    return NextResponse.json({
      transcript: data.text ?? "",
    });
  } catch (e: any) {
    console.error("Transcribe route error:", e);
    return NextResponse.json(
      { error: "failed_to_transcribe", detail: e?.message },
      { status: 500 }
    );
  }
}
