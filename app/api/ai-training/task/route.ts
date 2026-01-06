// app/api/ai-training/task/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ScenarioKey = "consulting" | "finance" | "bizdev" | "backoffice" | "student";

function makeSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

function pickSeedString() {
  const now = BigInt(Date.now());
  const rand = BigInt(Math.floor(Math.random() * 1_000_000));
  const seed = now * BigInt(1_000_000) + rand;
  return seed.toString(); // bigintをJSONで返せないので string
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const scenario = (url.searchParams.get("scenario") ?? "consulting") as ScenarioKey;

    const supabase = makeSupabaseAdmin();

    // 1) task（is_active=true）候補
    const { data: tasks, error: taskErr } = await supabase
      .from("acs_tasks")
      .select("id, scenario, scene_key, title, description, time_limit_sec, max_turns, output_format, rubric_hints, is_active, created_at")
      .eq("scenario", scenario)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(50);

    if (taskErr) throw taskErr;
    if (!tasks || tasks.length === 0) {
      return NextResponse.json({ ok: false, error: "NO_TASKS" }, { status: 404 });
    }

    // 2) ランダムにtaskを選ぶ（後でscene_key固定などにも拡張可）
    const pickedTask = tasks[Math.floor(Math.random() * tasks.length)];

    // 3) variant（active）を取る。anchor優先 → 無ければランダム
    const { data: variants, error: varErr } = await supabase
      .from("acs_task_variants")
      .select("id, task_id, variant_key, difficulty, params, prompt_template, evaluation_focus, is_anchor, is_active, created_at")
      .eq("task_id", pickedTask.id)
      .eq("is_active", true)
      .order("is_anchor", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(20);

    if (varErr) throw varErr;
    if (!variants || variants.length === 0) {
      return NextResponse.json({ ok: false, error: "NO_VARIANTS" }, { status: 404 });
    }

    const pickedVariant =
      variants.find((v: any) => v.is_anchor) ?? variants[Math.floor(Math.random() * variants.length)];

    const task_seed = pickSeedString();

    return NextResponse.json(
      {
        ok: true,
        task: pickedTask,
        variant: pickedVariant,
        task_seed, // string
        task_mode: pickedVariant.is_anchor ? "anchor" : "variant",
      },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("ai-training task error:", e);
    return NextResponse.json({ ok: false, error: "SERVER_ERROR" }, { status: 500 });
  }
}
