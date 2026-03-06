// app/api/case/transcribe/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;

// ひとまず 25MB（必要なら調整）
const MAX_BYTES = 25 * 1024 * 1024;

export async function POST(req: Request) {
  try {
    if (!OPENAI_API_KEY) {
      return NextResponse.json(
        { ok: false, error: "server_config", message: "OPENAI_API_KEY is not set" },
        { status: 500 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { ok: false, error: "no_file", message: "file is required" },
        { status: 400 }
      );
    }

    if (typeof file.size === "number" && file.size > MAX_BYTES) {
      return NextResponse.json(
        {
          ok: false,
          error: "file_too_large",
          message: `Audio file is too large: ${Math.round(file.size / 1024 / 1024)}MB (max ${Math.round(
            MAX_BYTES / 1024 / 1024
          )}MB). Try shorter or lower bitrate.`,
        },
        { status: 413 }
      );
    }

    // ✅ 受け取ったFileをそのままOpenAIへ（ここが重要）
    const fd = new FormData();
    fd.append("file", file, (file as any).name ?? "audio.webm");
    fd.append("model", "gpt-4o-mini-transcribe");

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: fd,
    });

    const raw = await response.text().catch(() => "");
    if (!response.ok) {
      console.error("OpenAI transcribe error:", raw);
      return NextResponse.json(
        { ok: false, error: "openai_error", message: raw || `status=${response.status}` },
        { status: 500 }
      );
    }

    const data = raw ? JSON.parse(raw) : {};
    return NextResponse.json({
      ok: true,
      transcript: data?.text ?? "",
    });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json(
      { ok: false, error: "server_error", message: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}