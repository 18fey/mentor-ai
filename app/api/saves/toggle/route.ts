// app/api/saves/toggle/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getUserPlan, type Plan } from "@/lib/plan";

type SaveType = "mistake" | "learning" | "retry";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PAID_ONLY_TYPES: SaveType[] = ["learning", "retry"];
const FREE_SAVE_LIMIT = 3;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      userId: string;
      attemptId: string;
      saveType: SaveType;
      enabled: boolean; // true=保存 / false=解除
    };

    const { userId, attemptId, saveType, enabled } = body;

    if (!userId || !attemptId || !saveType) {
      return NextResponse.json(
        { error: "bad_request", message: "userId/attemptId/saveType is required" },
        { status: 400 }
      );
    }

    const plan = await getUserPlan(userId);

    // ✅ learning/retry は有料のみ
    if (plan === "free" && PAID_ONLY_TYPES.includes(saveType)) {
      return NextResponse.json(
        {
          error: "upgrade_required",
          code: "SAVE_TYPE_PAID_ONLY",
          plan,
          message: "learning / retry の保存は PRO 限定です。",
        },
        { status: 403 }
      );
    }

    // 解除
    if (!enabled) {
      const { error } = await supabaseAdmin
        .from("saved_items")
        .delete()
        .eq("user_id", userId)
        .eq("attempt_id", attemptId)
        .eq("save_type", saveType);

      if (error) throw error;

      return NextResponse.json({ ok: true, plan, enabled: false });
    }

    // ✅ FREEは「保存3件まで」(saveTypeごとに3件、じゃなくて合算3件が分かりやすい)
    if (plan === "free") {
      const { count, error: countError } = await supabaseAdmin
        .from("saved_items")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId);

      if (countError) throw countError;

      const used = count ?? 0;
      if (used >= FREE_SAVE_LIMIT) {
        return NextResponse.json(
          {
            error: "limit_exceeded",
            code: "SAVE_LIMIT_REACHED",
            plan,
            remaining: 0,
            message: "無料プランの保存は最大3件までです。PROで無制限に保存できます。",
          },
          { status: 403 }
        );
      }
    }

    // 保存（upsert）
    const { error } = await supabaseAdmin.from("saved_items").upsert(
      {
        user_id: userId,
        attempt_id: attemptId,
        save_type: saveType,
      },
      { onConflict: "user_id,attempt_id,save_type" }
    );

    if (error) throw error;

    return NextResponse.json({ ok: true, plan, enabled: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
