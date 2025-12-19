// app/api/saves/toggle/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

type SaveType = "mistake" | "learning" | "retry";
type Database = any;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // ← env名がこれで合ってるかだけ要確認
);

const PAID_ONLY_TYPES: SaveType[] = ["learning", "retry"];
const FREE_SAVE_LIMIT = 3;

function createSupabaseFromCookies() {
  const cookieStore = cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        async get(name: string) {
          return (await cookieStore).get(name)?.value;
        },
      },
    }
  );
}

// ✅ ここで plan を “確実に” 取る（RLSに左右されない）
async function getPlanByAuthUserId(
  authUserId: string
): Promise<"free" | "pro"> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("plan")
    .eq("id", authUserId) // ← ここを修正
    .maybeSingle();

  if (error) {
    console.error("getPlanByAuthUserId error:", error);
    return "free";
  }

  return (data?.plan as "free" | "pro") ?? "free";
}


export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      attemptId: string;
      attemptType?: string;
      saveType: SaveType;
      enabled: boolean;

      title?: string;
      summary?: string;
      scoreTotal?: number | null;
      payload?: any;
      sourceId?: string | null;
    };

    // ✅ ログはここ（body取得後）
    console.log("[/api/saves/toggle] body =", {
      attemptId: body?.attemptId,
      attemptType: body?.attemptType,
      saveType: body?.saveType,
      enabled: body?.enabled,
    });

    const {
      attemptId,
      attemptType = "case",
      saveType,
      enabled,
      title,
      summary,
      scoreTotal,
      payload,
      sourceId,
    } = body;

    if (!attemptId || !saveType || typeof enabled !== "boolean") {
      return NextResponse.json(
        { error: "bad_request", message: "attemptId/saveType/enabled is required" },
        { status: 400 }
      );
    }

    // ✅ cookieで本人確定
    const supabase = createSupabaseFromCookies();
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user?.id) {
      return NextResponse.json(
        { error: "unauthorized", message: "login required" },
        { status: 401 }
      );
    }

    const userId = userData.user.id;

    // ✅ PRO認識をここで確実に
    const plan = await getPlanByAuthUserId(userId);
    console.log("[/api/saves/toggle] authUserId =", userId, "plan =", plan);

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
        .eq("attempt_type", attemptType)
        .eq("save_type", saveType);

      if (error) throw error;
      return NextResponse.json({ ok: true, plan, enabled: false });
    }

    // ✅ FREEは「保存3件まで」（合算）
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

    // ✅ 保存（スナップショット込み）
    const row = {
      user_id: userId,
      attempt_type: attemptType,
      attempt_id: attemptId,
      save_type: saveType,
      title: title ?? null,
      summary: summary ?? null,
      score_total: typeof scoreTotal === "number" ? scoreTotal : null,
      payload: payload ?? null,
      source_id: sourceId ?? null,
    };

    const { error } = await supabaseAdmin
      .from("saved_items")
      .upsert(row, { onConflict: "user_id,attempt_type,attempt_id,save_type" });

    if (error) throw error;

    return NextResponse.json({ ok: true, plan, enabled: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "server_error", message: "failed to toggle save" },
      { status: 500 }
    );
  }
}
