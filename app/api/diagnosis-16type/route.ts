import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { ThinkingTypeId } from "@/lib/careerFitMap";

type AxisScore = {
  strategic: number;
  analytical: number;
  intuitive: number;
  creative: number;
};

export async function POST() {
  try {
    const cookieStore = await cookies();

    const supabase = createServerClient<any>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
        },
      }
    );

    /* ------------------------
       1. Auth
    ------------------------ */
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "ログインが必要です。" },
        { status: 401 }
      );
    }

    /* ------------------------
       2. プロフィールから固定診断結果を取得
    ------------------------ */
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("ai_type_key, ai16_axis_score")
      .eq("auth_user_id", user.id)
      .single();

    if (profileError || !profile?.ai_type_key) {
      return NextResponse.json(
        { error: "診断結果が見つかりません。" },
        { status: 404 }
      );
    }

    const thinkingTypeId = profile.ai_type_key as ThinkingTypeId;
    const axisScore = profile.ai16_axis_score as AxisScore | null;

    /* ------------------------
       3. OpenAI で説明文だけ生成
    ------------------------ */
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "サーバー設定エラー（APIキー未設定）" },
        { status: 500 }
      );
    }

    const axisSummary = axisScore
      ? `- 戦略: ${axisScore.strategic}
- 分析: ${axisScore.analytical}
- 直感: ${axisScore.intuitive}
- 創造: ${axisScore.creative}`
      : "スコア情報なし";

    const systemPrompt = `
あなたは、就活OS「Mentor.AI」のキャリアコーチAIです。
ユーザーのAI思考タイプ診断結果をもとに、
「自分はどういうタイプで、どう就活を戦えばいいか」が
自然に腹落ちする説明を行ってください。

トーン:
- 上から目線にならない
- 優秀な先輩メンターのような語り口
- 不安を煽らず、戦い方を示す
`;

    const userPrompt = `
【AI思考タイプID】
${thinkingTypeId}

【思考バランス】
${axisSummary}

出力フォーマット（日本語）:
1. このタイプの本質（短い要約）
2. 強みとして活きやすいポイント（3〜5）
3. 就活でハマりやすい場面
4. 気をつけたい思考のクセ
5. このタイプにおすすめの戦い方

※診断結果はすでに確定しています。
説明はブレず、一貫性を持たせてください。
`;

    const completionRes = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.6,
          max_tokens: 900,
        }),
      }
    );

    if (!completionRes.ok) {
      const text = await completionRes.text();
      console.error("OpenAI error:", text);
      return NextResponse.json(
        { error: "AI生成に失敗しました。" },
        { status: 500 }
      );
    }

    const json = await completionRes.json();
    const resultText =
      json.choices?.[0]?.message?.content?.trim() ?? "";

    /* ------------------------
       4. レスポンス
    ------------------------ */
    return NextResponse.json({
      thinkingTypeId,
      result: resultText,
    });
  } catch (err) {
    console.error("diagnosis-16type route error:", err);
    return NextResponse.json(
      { error: "サーバーエラーが発生しました。" },
      { status: 500 }
    );
  }
}
