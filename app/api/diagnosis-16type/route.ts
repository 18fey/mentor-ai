// app/api/diagnosis-16type/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { requireAndConsumeMetaIfNeeded } from "@/lib/payment/featureGate";
import type { ThinkingTypeId } from "@/lib/careerFitMap";

type AxisScore = {
  strategic: number;
  analytical: number;
  intuitive: number;
  creative: number;
};

type RequestBody = {
  thinkingTypeId: ThinkingTypeId;
  thinkingTypeNameJa: string;
  thinkingTypeNameEn: string;
  typeSummary: string;
  axisScore?: AxisScore;
  mode?: "basic" | "deep";
  userContext?: string; // 任意：キャリア状況など
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RequestBody;

    const {
      thinkingTypeId,
      thinkingTypeNameJa,
      thinkingTypeNameEn,
      typeSummary,
      axisScore,
      mode = "basic",
      userContext,
    } = body;

    if (!thinkingTypeId || !thinkingTypeNameJa || !thinkingTypeNameEn) {
      return NextResponse.json(
        { error: "thinkingType の情報が不足しています。" },
        { status: 400 }
      );
    }

    // Deep モードは課金ゲート＋必要に応じて Meta を消費
    if (mode === "deep") {
      const gate = await requireAndConsumeMetaIfNeeded(
        "diagnosis_16type_deep",
        1 // Deep1回につきMeta1枚
      );
      if (!gate.ok) {
        if (gate.status === 401) {
          return NextResponse.json(
            { error: "ログインが必要です。" },
            { status: 401 }
          );
        }
        // 402 Payment Required
        return NextResponse.json(
          {
            error:
              "16タイプのDeep解説は有料機能です。MetaコインまたはProプランをご利用ください。",
          },
          { status: 402 }
        );
      }
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error("OPENAI_API_KEY is not set");
      return NextResponse.json(
        { error: "サーバー設定エラー（APIキー未設定）" },
        { status: 500 }
      );
    }

    const axisSummary = axisScore
      ? `- 戦略(Strategic): ${axisScore.strategic}
- 分析(Analytical): ${axisScore.analytical}
- 直感(Intuitive): ${axisScore.intuitive}
- 創造(Creative): ${axisScore.creative}`
      : "スコア情報なし";

    const userContextText = userContext
      ? `\n【ユーザー文脈】\n${userContext}\n`
      : "";

    const depthHint =
      mode === "deep"
        ? "かなり具体的かつ実務レベルで役立つ内容にしてください。"
        : "分量は中程度で、要点を分かりやすくまとめてください。";

    const systemPrompt = `
あなたは、就活OS「Mentor.AI」に搭載されたキャリアコーチAIです。
ユーザーの「AI思考タイプ」診断結果にもとづき、就活生が自分の強みを理解し、
実際の就活・キャリア選択に活かせるように解説を作成します。

トーン:
- 上から目線ではなく、「一緒に作戦を考える相棒」のような口調
- 具体例とニュアンスを大事にする
- 不安を煽らず、「こう戦えばちゃんと戦える」を伝える
`;

    const userPrompt = `
【タイプID】${thinkingTypeId}
【タイプ名】${thinkingTypeNameJa} / ${thinkingTypeNameEn}
【タイプ概要】${typeSummary}

【思考バランス（参考）】
${axisSummary}

${userContextText}

出力フォーマット（日本語）:
1. タイプの核となる強み（3〜5点）
2. 就活・仕事の場面で「ハマりやすいシーン」
3. 気をつけたい思考のクセ（2〜4点）
4. このタイプならではの戦い方・キャリア戦略
5. AIとの付き合い方のコツ（プロンプトの書き方や役割分担など）

${depthHint}
見出しや箇条書きを使って、プレーンテキストで出力してください。
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
          temperature: mode === "deep" ? 0.8 : 0.7,
          max_tokens: mode === "deep" ? 1400 : 800,
        }),
      }
    );

    if (!completionRes.ok) {
      const text = await completionRes.text();
      console.error("OpenAI API error:", completionRes.status, text);
      return NextResponse.json(
        { error: "AI生成に失敗しました。" },
        { status: 500 }
      );
    }

    const json = await completionRes.json();
    const resultText: string =
      json.choices?.[0]?.message?.content?.trim() ?? "";

    // 🧠 ここから：診断ログ＋Growthログ保存（失敗してもレスポンスは返す）
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

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        console.error("diagnosis-16type auth error for logging:", authError);
      }

      if (user) {
        // diagnosis_logs に保存
        const { data: inserted, error: insertError } = await supabase
          .from("diagnosis_logs")
          .insert({
            user_id: user.id,
            thinking_type_id: thinkingTypeId as string,
            axis_score: axisScore ?? null,
            mode,
            result_text: resultText,
          })
          .select("id")
          .single();

        if (insertError) {
          console.error("diagnosis_logs insert error:", insertError);
        }

        const diagnosisLogId = inserted?.id;

        // growth_logs にも1行追加（タイムライン用）
        const title =
          mode === "deep"
            ? `Deep診断レポートを生成 (${thinkingTypeNameJa})`
            : `AI思考タイプ診断を実施 (${thinkingTypeNameJa})`;

        const description =
          mode === "deep"
            ? "あなたの思考タイプのDeepレポートを生成しました。"
            : "AI思考タイプ診断の結果を保存しました。";

        const { error: growthError } = await supabase.from("growth_logs").insert({
          user_id: user.id,
          source: "diagnosis",
          title,
          description,
          metadata: {
            thinking_type_id: thinkingTypeId,
            mode,
            diagnosis_log_id: diagnosisLogId ?? null,
          },
        });

        if (growthError) {
          console.error("growth_logs insert error (diagnosis):", growthError);
        }
      }
    } catch (logErr) {
      console.error("diagnosis-16type logging error:", logErr);
    }

    return NextResponse.json({ result: resultText, mode });
  } catch (err) {
    console.error("diagnosis-16type route error:", err);
    return NextResponse.json(
      { error: "サーバーエラーが発生しました。" },
      { status: 500 }
    );
  }
}
