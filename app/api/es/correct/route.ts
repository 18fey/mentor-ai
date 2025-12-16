// app/api/es/correct/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getUserPlan } from "@/lib/plan";
import { supabaseServer } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;

type Plan = "free" | "beta" | "pro";

type EsFeedback = {
  summary: string;
  strengths: string[];
  improvements: string[];
  sampleRewrite: string;
};

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

// OpenAI で ES 添削してもらう関数
async function callOpenAIForES(input: {
  esText: string;
  company?: string;
  questionType?: string;
}): Promise<EsFeedback> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `
あなたは外資コンサル・外銀のES選考官です。
以下の情報（会社名・設問タイプ・ES本文）をもとに、
構成・ロジック・具体性・説得力をプロ目線で添削してください。

必ず次のJSON形式「だけ」を出力してください：

{
  "summary": "全体のコメント（2〜3文）",
  "strengths": ["良い点1", "良い点2", "良い点3"],
  "improvements": ["改善ポイント1", "改善ポイント2", "改善ポイント3"],
  "sampleRewrite": "400〜600字程度の書き直し例（同じ内容だが表現と構成を整えたもの）"
}
          `.trim(),
        },
        { role: "user", content: JSON.stringify(input, null, 2) },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("ES correct OpenAI error:", res.status, text);
    throw new Error("ES添削AIでエラーが発生しました。");
  }

  const json = await res.json();
  const text = json.choices?.[0]?.message?.content as string | undefined;

  if (!text) {
    console.error("ES correct OpenAI invalid response:", json);
    throw new Error("ES添削AIのレスポンスが不正です。");
  }

  let parsed: any = {};
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    console.error("ES correct JSON.parse failed:", text);
    throw new Error("ES添削AIのJSON解析に失敗しました。");
  }

  return {
    summary: parsed.summary ?? "",
    strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
    improvements: Array.isArray(parsed.improvements) ? parsed.improvements : [],
    sampleRewrite: parsed.sampleRewrite ?? "",
  };
}

// profiles から profile_id を取る（FK用）
async function getProfileByAuthUserId(authUserId: string) {
  const { data, error } = await supabaseServer
    .from("profiles")
    .select("id, plan")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (error || !data) {
    console.error("profiles not found:", error);
    throw new Error("ユーザープロファイルが見つかりません。");
  }

  return data as { id: string; plan: Plan };
}

export async function POST(req: NextRequest) {
  try {
    // 0) auth 確定（cookie session）
    const supabase = await createSupabaseFromCookies();
    const { data: auth, error: authErr } = await supabase.auth.getUser();
    const user = auth?.user ?? null;

    if (authErr || !user?.id) {
      return NextResponse.json(
        { error: "unauthorized", message: "ログインが必要です。" },
        { status: 401 }
      );
    }

    const authUserId = user.id;

    // 1) body（userIdは受け取らない）
    const { esText, company, questionType, storyCardId } = await req.json();

    if (!esText) {
      return NextResponse.json(
        { error: "invalid_request", message: "esText は必須です。" },
        { status: 400 }
      );
    }

    // 2) プラン取得（free/beta/pro）
    const plan = (await getUserPlan(authUserId)) as Plan;

    // 3) profile 取得（FK用）
    const profile = await getProfileByAuthUserId(authUserId);

    // 4) OpenAI
    const full = await callOpenAIForES({ esText, company, questionType });

    // 5) es_corrections 保存
    const { error: insertError } = await supabaseServer
      .from("es_corrections")
      .insert({
        profile_id: profile.id,
        story_card_id: storyCardId ?? null,
        company_name: company ?? null,
        question: questionType ?? null,
        original_text: esText,
        ai_feedback: full,
        ai_rewrite: plan === "pro" ? full.sampleRewrite : null,
      });

    if (insertError) {
      console.error("es_corrections insert error:", insertError);
    }

    // 6) es_logs / growth_logs（失敗しても表は返す）
    try {
      const { error: esLogError } = await supabaseServer.from("es_logs").insert({
        profile_id: profile.id,
        company_name: company ?? null,
        es_question: questionType ?? null,
        es_before: esText,
        es_after: plan === "pro" ? full.sampleRewrite : null,
        mode: plan === "pro" ? "pro_correct" : "lite_correct",
        score: null,
      });
      if (esLogError) console.error("es_logs insert error:", esLogError);

      const titleBase = company ? `ES添削：${company}` : "ES添削";
      const title = plan === "pro" ? `${titleBase} [PRO]` : `${titleBase} [Lite]`;
      const description =
        plan === "pro"
          ? "PROプランとしてES添削（改善案＆書き換え例）を生成しました。"
          : "ES添削の一部フィードバックを生成しました。（詳細はPRO限定）";

      // ※ growth_logs の user_id が auth user id 前提でOK
      const { error: growthError } = await supabaseServer.from("growth_logs").insert({
        user_id: authUserId,
        source: "es",
        title,
        description,
        metadata: {
          mode: plan,
          locked: plan !== "pro",
          company: company ?? null,
          questionType: questionType ?? null,
          story_card_id: storyCardId ?? null,
        },
      });

      if (growthError) {
        console.error("growth_logs insert error (es_correct):", growthError);
      }
    } catch (logErr) {
      console.error("es_logs / growth_logs logging error:", logErr);
    }

    // 7) plan別レスポンス
    if (plan === "pro") {
      return NextResponse.json({ plan, locked: false, feedback: full });
    }

    const partial: EsFeedback = {
      summary: full.summary,
      strengths: full.strengths.slice(0, 1),
      improvements: [],
      sampleRewrite:
        (full.sampleRewrite ?? "").slice(0, 80) +
        ((full.sampleRewrite ?? "").length > 80 ? "…" : ""),
    };

    return NextResponse.json({
      plan,
      locked: true,
      feedback: partial,
      message: "ES添削の詳細な改善案・書き換え例は PRO プラン限定です。続きは PRO でご覧いただけます。",
    });
  } catch (e) {
    console.error("[/api/es/correct] server_error:", e);
    return NextResponse.json(
      { error: "server_error", message: "ES添削中にエラーが発生しました。" },
      { status: 500 }
    );
  }
}
