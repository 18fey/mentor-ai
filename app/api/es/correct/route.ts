// app/api/es/correct/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getUserPlan } from "@/lib/plan";
import { supabaseServer } from "@/lib/supabase-server";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;

type Plan = "free" | "beta" | "pro";

type EsFeedback = {
  summary: string;        // 全体の要約コメント
  strengths: string[];    // 良い点
  improvements: string[]; // 改善ポイント
  sampleRewrite: string;  // 書き直し例（Pro用）
};

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
        {
          role: "user",
          content: JSON.stringify(input, null, 2),
        },
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

  const parsed = JSON.parse(text);

  const feedback: EsFeedback = {
    summary: parsed.summary ?? "",
    strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
    improvements: Array.isArray(parsed.improvements) ? parsed.improvements : [],
    sampleRewrite: parsed.sampleRewrite ?? "",
  };

  return feedback;
}

// プロファイル→profile_id を取る（es_corrections 用）
async function getProfileByAuthUserId(userId: string) {
  const { data, error } = await supabaseServer
    .from("users_profile")
    .select("id, plan")
    .eq("auth_user_id", userId)
    .maybeSingle();

  if (error || !data) {
    console.error("users_profile not found:", error);
    throw new Error("ユーザープロファイルが見つかりません。");
  }

  return data as { id: string; plan: Plan };
}

export async function POST(req: NextRequest) {
  try {
    const { userId, esText, company, questionType, storyCardId } =
      await req.json();

    if (!userId || !esText) {
      return NextResponse.json(
        { error: "invalid_request", message: "userId と esText は必須です。" },
        { status: 400 }
      );
    }

    // 1. プラン取得（free / beta / pro）
    const plan = (await getUserPlan(userId)) as Plan;

    // 2. profile_id を取得（es_corrections のFK用）
    const profile = await getProfileByAuthUserId(userId);

    // 3. OpenAI でフルフィードバック生成
    const full: EsFeedback = await callOpenAIForES({
      esText,
      company,
      questionType,
    });

    // 4. Supabase に履歴を保存（常に full を保存）
    const { error: insertError } = await supabaseServer
      .from("es_corrections")
      .insert({
        profile_id: profile.id,
        story_card_id: storyCardId ?? null,
        company_name: company ?? null,
        question: questionType ?? null,
        original_text: esText,
        ai_feedback: full, // JSONB でそのまま保存
        ai_rewrite: plan === "pro" ? full.sampleRewrite : null,
      });

    if (insertError) {
      console.error("es_corrections insert error:", insertError);
    }

    // 5. レスポンスをプラン別に出し分け

    if (plan === "pro") {
      // PROはフルで返す
      return NextResponse.json({
        plan,
        locked: false,
        feedback: full,
      });
    }

    // FREE/BETA：一部だけ見せる & アップセル
    const partial: EsFeedback = {
      summary: full.summary,
      strengths: full.strengths.slice(0, 1), // 最初の1個だけ表示
      improvements: [], // 改善案は非表示
      sampleRewrite:
        full.sampleRewrite?.slice(0, 80) +
        (full.sampleRewrite && full.sampleRewrite.length > 80 ? "…" : ""),
    };

    return NextResponse.json({
      plan,
      locked: true,
      feedback: partial,
      message:
        "ES添削の詳細な改善案・書き換え例は PRO プラン限定です。続きは PRO でご覧いただけます。",
    });
  } catch (e) {
    console.error("[/api/es/correct] server_error:", e);
    return NextResponse.json(
      { error: "server_error", message: "ES添削中にエラーが発生しました。" },
      { status: 500 }
    );
  }
}
