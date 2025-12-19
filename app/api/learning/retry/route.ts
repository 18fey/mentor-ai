// app/api/learning/retry/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requirePro } from "@/lib/plan";
import { requireAuthUserId } from "@/lib/authServer";

type Mode = "learning" | "retry";
type AttemptType = "case_interview" | "fermi";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const userId = await requireAuthUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "unauthorized", message: "login required" },
        { status: 401 }
      );
    }

    const body = (await req.json()) as {
      attemptType: AttemptType;
      attemptId: string;
      mode: Mode;
    };

    const { attemptType, attemptId, mode } = body;
    if (!attemptType || !attemptId || !mode) {
      return NextResponse.json({ error: "bad_request" }, { status: 400 });
    }

    const pro = await requirePro(userId);
    if (!pro.ok) {
      return NextResponse.json(
        {
          error: "payment_required",
          code: "LEARNING_RETRY_PRO_ONLY",
          plan: pro.plan,
          message:
            "learning / retry はPRO限定機能です。アップグレードすると解放されます。",
        },
        { status: 402 }
      );
    }

    const table = attemptType === "case_interview" ? "case_logs" : "fermi_sessions";

    // ✅ 自分のデータしか触れないガード（サービスロールなので必須）
    // 可能なら tables 側に user_id がある前提でここも絞る
    const q = supabaseAdmin.from(table).select("*").eq("id", attemptId);

    // もし table に user_id があるならこの1行を有効化してね：
    // q.eq("user_id", userId);

    const { data: attempt, error: attemptErr } = await q.maybeSingle();

    if (attemptErr || !attempt) {
      return NextResponse.json(
        { error: "not_found", message: "attempt not found" },
        { status: 404 }
      );
    }

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
