// app/api/es/correct/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getUserPlan } from "@/lib/plan";

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
      temperature: 0.3,
      max_tokens: 900,
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
  } catch {
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

export async function POST(req: NextRequest) {
  try {
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

    const body = (await req.json().catch(() => null)) as any;
    if (!body) {
      return NextResponse.json({ error: "invalid_json" }, { status: 400 });
    }

    const esText = typeof body.esText === "string" ? body.esText : "";
    const company = typeof body.company === "string" ? body.company.slice(0, 100) : "";
    const questionType = typeof body.questionType === "string" ? body.questionType.slice(0, 50) : "";
    const storyCardId = body.storyCardId ?? null;

    if (!esText || esText.trim().length < 30) {
      return NextResponse.json(
        { error: "invalid_request", message: "esText は必須です。（短すぎます）" },
        { status: 400 }
      );
    }

    // 1) plan（※ここはあなたの設計に合わせてOK）
    const plan = (await getUserPlan(authUserId)) as Plan;

    // 2) OpenAI
    const full = await callOpenAIForES({ esText, company, questionType });

    // 3) 保存（RLSが効く形で user_id 統一）
    // ※ es_corrections に user_id カラムが必要（後述SQL）
    const { error: corrErr } = await supabase.from("es_corrections").insert({
      user_id: authUserId,
      story_card_id: storyCardId,
      company_name: company || null,
      question: questionType || null,
      original_text: esText,
      ai_feedback: full,
      ai_rewrite: plan === "pro" ? full.sampleRewrite : null,
      created_at: new Date().toISOString(),
    });

    if (corrErr) console.error("es_corrections insert error:", corrErr);

    const { error: esLogError } = await supabase.from("es_logs").insert({
      user_id: authUserId,
      company_name: company || null,
      es_question: questionType || null,
      es_before: esText,
      es_after: plan === "pro" ? full.sampleRewrite : null,
      mode: plan === "pro" ? "pro_correct" : "lite_correct",
      score: null,
      created_at: new Date().toISOString(),
    });

    if (esLogError) console.error("es_logs insert error:", esLogError);

    const titleBase = company ? `ES添削：${company}` : "ES添削";
    const title = plan === "pro" ? `${titleBase} [PRO]` : `${titleBase} [Lite]`;
    const description =
      plan === "pro"
        ? "PROプランとしてES添削（改善案＆書き換え例）を生成しました。"
        : "ES添削の一部フィードバックを生成しました。（詳細はPRO限定）";

    const { error: growthErr } = await supabase.from("growth_logs").insert({
      user_id: authUserId,
      source: "es",
      title,
      description,
      metadata: {
        mode: plan,
        locked: plan !== "pro",
        company: company || null,
        questionType: questionType || null,
        story_card_id: storyCardId,
      },
      created_at: new Date().toISOString(),
    });

    if (growthErr) console.error("growth_logs insert error (es_correct):", growthErr);

    // 4) plan別レスポンス
    if (plan === "pro") {
      return NextResponse.json({ plan, locked: false, feedback: full });
    }

    const partial: EsFeedback = {
      summary: full.summary,
      strengths: full.strengths.slice(0, 1),
      improvements: [],
      sampleRewrite:
        (full.sampleRewrite ?? "").slice(0, 80) + ((full.sampleRewrite ?? "").length > 80 ? "…" : ""),
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
