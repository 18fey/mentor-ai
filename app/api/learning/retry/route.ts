// app/api/learning/retry/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requirePro } from "@/lib/plan";

type Mode = "learning" | "retry";
type AttemptType ="case_interview"| "fermi";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      userId: string;
      attemptType: AttemptType;
      attemptId: string;
      mode: Mode;
    };

    const { userId, attemptType, attemptId, mode } = body;
    if (!userId || !attemptType || !attemptId || !mode) {
      return NextResponse.json({ error: "bad_request" }, { status: 400 });
    }

    // ✅ PRO限定
    const pro = await requirePro(userId);
    if (!pro.ok) {
      return NextResponse.json(
        {
          error: "payment_required",
          code: "LEARNING_RETRY_PRO_ONLY",
          plan: pro.plan,
          message: "learning / retry はPRO限定機能です。アップグレードすると解放されます。",
        },
        { status: 402 }
      );
    }

    // ここから：元attemptの取得
    // ※ case_logs / fermi_sessions のカラムが確定してないので、
    // “まずはJSONをそのまま保存してる列”がある想定で読みます（後で実カラムに合わせて調整）
    const table = attemptType ==="case_interview" ? "case_logs" : "fermi_sessions";

    const { data: attempt, error: attemptErr } = await supabaseAdmin
      .from(table)
      .select("*")
      .eq("id", attemptId)
      .maybeSingle();

    if (attemptErr || !attempt) {
      return NextResponse.json(
        { error: "not_found", message: "attempt not found" },
        { status: 404 }
      );
    }

    // TODO: ここでOpenAIに投げて「同構造・別数値・別業界」で再生成する
    // 今は返すだけ（本番ではcallOpenAIに差し替え）
    return NextResponse.json({
      ok: true,
      mode,
      attemptType,
      original: attempt,
      regenerated: {
        dummy: true,
        message: "ここをOpenAI生成に差し替える（同じ構造・別条件）",
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
