// app/api/career-gap/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import {
  CAREER_FIT_MAP,
  INDUSTRIES,
  IndustryId,
  FitSymbol,
  ThinkingTypeId,
} from "@/lib/careerFitMap";
import {
  requireAndConsumeMetaIfNeeded,
} from "@/lib/payment/featureGate";

// 「◎ / ○ / △ / ✕」の意味を文章にする
const FIT_SYMBOL_DESC: Record<FitSymbol, string> = {
  "◎":
    "とても相性が良い（タイプの強みと業界の求める力がかなり重なる）",
  "○":
    "概ね相性が良い（一部ギャップはあるが、戦い方次第で十分戦える）",
  "△":
    "工夫すれば活かせる（前提を理解しておかないとしんどくなりやすい）",
  "✕":
    "かなりギャップが大きい（よほど強い動機や環境選び・企業選びが必要）",
};

// ———————————————
// SYSTEM PROMPT（本番用）
// ———————————————
const SYSTEM_PROMPT = `
あなたは、日本の就活生向けの「キャリアコーチAI」です。
ユーザーは「Mentor.AI 16タイプ診断」の結果（思考タイプ）と、
最大3つまでの「志望業界」を入力します。

あなたの役割は、以下を日本語でわかりやすくフィードバックすることです。

▼インプットとして渡される情報
- Thinking Type（AI思考タイプ）のID・日英名称・要約説明
- そのタイプと各業界の「相性マップ」（◎ / ○ / △ / ✕ とその意味）
- ユーザーが選んだ 志望業界（最大3つ）
- ユーザーの志望理由（任意）
- ガクチカ・これまでの経験サマリ（任意）

▼あなたが出力すべき内容（フォーマット厳守）
Markdown形式で、以下の構成で出力してください。

# キャリア相性レポート

## 0. あなたの思考タイプまとめ
- タイプ名: {{ThinkingTypeNameJa}} / {{ThinkingTypeNameEn}}
- 一言要約（あなたの言葉で簡潔に）  
- このタイプが就活で活きやすいポイント（3つ）

---

そのあと、志望業界ごとにセクションを分けてください。
志望業界が2つなら「1」「2」まで、3つなら「1〜3」まで作成します。

## 1. {{志望業界名1}} との相性

### 1-1. 総合評価
- マッチ度: 「◎ とても相性が良い」/「○ 相性はまずまず」/「△ 工夫すれば活かせる」/「✕ かなりギャップあり」 から1つ
- 一言コメント（2〜3行）

### 1-2. マッチしている点
- 箇条書きで3〜5個
- Thinking Type の特徴と、業界側で評価されやすいポイントを結びつけて書く

### 1-3. ギャップになりやすい点
- 箇条書きで3〜5個
- マインドセット／働き方／求められるスキルの観点で、リアルなギャップを書く
- 「向いてない」と断定するのではなく、「こういう癖があるとしんどくなりやすい」という書き方にする

### 1-4. 具体的な打ち手（3ヶ月プラン）
- 直近3ヶ月でできるアクションを箇条書きで5個程度
- ES・面接でどう語るか、どんなインターン・副業・勉強が良いか、などを具体的に

---

## 2. {{志望業界名2}} との相性
（上と同じ構成で記載）

## 3. {{志望業界名3}} との相性
（上と同じ構成で記載）

▼重要なトーン
- 上から目線ではなく、「一緒に作戦を考えるメンター」の口調
- 「向いてないから諦めろ」とは絶対に言わない
- ギャップが大きい場合も、「だからこそ、こういう戦い方ならアリ」という代替案を必ず出す
- 難しい専門用語は避け、就活生がそのままメモに写せるレベルの日本語で書く
`;

type CareerGapRequestBody = {
  thinkingTypeId?: string;
  thinkingTypeNameJa?: string;
  thinkingTypeNameEn?: string;
  typeDescription?: string;
  desiredIndustryIds?: IndustryId[];
  userReason?: string;
  userExperienceSummary?: string;
  mode?: "basic" | "deep"; // Fast / Deep 切り替え
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CareerGapRequestBody;

    const thinkingTypeId = String(body.thinkingTypeId || "");
    const thinkingTypeNameJa = body.thinkingTypeNameJa ?? "";
    const thinkingTypeNameEn = body.thinkingTypeNameEn ?? "";
    const typeDescription = body.typeDescription ?? "";

    const desiredIndustryIds: IndustryId[] = Array.isArray(
      body.desiredIndustryIds
    )
      ? body.desiredIndustryIds
      : [];

    const userReason = body.userReason ?? "";
    const userExperienceSummary = body.userExperienceSummary ?? "";
    const mode: "basic" | "deep" = body.mode ?? "basic";

    if (!thinkingTypeId) {
      return NextResponse.json(
        { error: "thinkingTypeId is required" },
        { status: 400 }
      );
    }

    if (desiredIndustryIds.length === 0) {
      return NextResponse.json(
        { error: "desiredIndustryIds is required" },
        { status: 400 }
      );
    }

    // Deep モードは課金ゲート＋Meta消費
    if (mode === "deep") {
      const gate = await requireAndConsumeMetaIfNeeded(
        "career_gap_deep",
        1 // 1回につき Meta 1枚
      );
      if (!gate.ok) {
        if (gate.status === 401) {
          return NextResponse.json(
            { error: "ログインが必要です。" },
            { status: 401 }
          );
        }
        return NextResponse.json(
          {
            error:
              "キャリア相性レポートのDeep版は有料機能です。MetaコインまたはProプランをご利用ください。",
          },
          { status: 402 }
        );
      }
    }

    // このタイプの業界相性マップを取得
    const fitMapRaw =
      CAREER_FIT_MAP[thinkingTypeId as ThinkingTypeId] ?? null;

    const industryFitLines = fitMapRaw
      ? Object.entries(fitMapRaw)
          .map(([id, symbol]) => {
            const meta = INDUSTRIES.find((i) => i.id === id);
            const labelJa = meta?.labelJa ?? id;
            const desc = FIT_SYMBOL_DESC[symbol as FitSymbol] ?? "";
            return `- ${id}（${labelJa}）: ${symbol} ${desc}`;
          })
          .join("\n")
      : "（この ThinkingTypeId の業界相性マップはまだ未定義です）";

    const desiredIndustriesForPrompt = desiredIndustryIds
      .map((id, index) => {
        const meta = INDUSTRIES.find((i) => i.id === id);
        const labelJa = meta?.labelJa ?? id;
        return `${index + 1}. ${id}（${labelJa}）`;
      })
      .join("\n");

    const modeHint =
      mode === "deep"
        ? `これは Deep モードです。各業界ごとのマッチ / ギャップ / 3ヶ月アクションを、面接やESでそのまま使えるレベルの具体性で書いてください。`
        : `これはライトモードです。全体の方向性がつかめるように、要点をコンパクトにまとめてください。`;

    const userPrompt = `
[Thinking Type]
ID: ${thinkingTypeId}
Name: ${thinkingTypeNameJa} / ${thinkingTypeNameEn}

[Type Description]
${typeDescription}

[Industry Fit Map for this Type]
${industryFitLines}

[Desired Industries (User Selected)]
${desiredIndustriesForPrompt}

[User Context]
- 志望理由（自由入力）:
${userReason || "（未入力）"}

- ガクチカ・これまでの経験サマリ:
${userExperienceSummary || "（未入力）"}

▼タスク
上記を踏まえて、「キャリア相性レポート」を作成してください。
志望業界ごとに、マッチ度・ギャップ・3ヶ月アクションプランまで具体的に書いてください。

${modeHint}
`;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error("OPENAI_API_KEY is not set");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        temperature: mode === "deep" ? 0.8 : 0.6,
        max_tokens: mode === "deep" ? 1400 : 900,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      console.error("OpenAI API error:", openaiRes.status, errText);
      return NextResponse.json(
        { error: "OpenAI API error", detail: errText },
        { status: 500 }
      );
    }

    const data = (await openaiRes.json()) as any;
    const content =
      data.choices?.[0]?.message?.content ?? "生成に失敗しました。";

    // 🧠 ここから：career_gap_logs ＋ growth_logs 保存（失敗してもレスポンスは返す）
    try {
      const cookieStore = await cookies();

      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
          cookies: {
            getAll() {
              return cookieStore.getAll();
            },
            setAll(cookiesToSet) {
              try {
                cookiesToSet.forEach(({ name, value, options }) =>
                  cookieStore.set(name, value, options)
                );
              } catch {
                // Route Handler など、読み取り専用のコンテキストでは無視
              }
            },
          },
        }
      );

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        console.error("career-gap auth error for logging:", authError);
      }

      if (user) {
        const selectedLabels = desiredIndustryIds.map((id) => {
          const meta = INDUSTRIES.find((i) => i.id === id);
          return meta?.labelJa ?? id;
        });

        // career_gap_logs に保存
        const { data: inserted, error: insertError } = await supabase
          .from("career_gap_logs")
          .insert({
            user_id: user.id,
            thinking_type_id: thinkingTypeId,
            selected_industries: desiredIndustryIds,
            mode,
            motivation_text: userReason || null,
            gakuchika_text: userExperienceSummary || null,
            result_text: content,
          })
          .select("id")
          .single();

        if (insertError) {
          console.error("career_gap_logs insert error:", insertError);
        }

        const gapLogId = inserted?.id;

        const titleBase =
          selectedLabels.length > 0
            ? `キャリア相性レポート（${selectedLabels.join(" × ")}）`
            : "キャリア相性レポート";

        const title =
          mode === "deep" ? `${titleBase} [Deep]` : titleBase;

        const description =
          mode === "deep"
            ? "志望業界との相性をDeepレベルで分析しました。"
            : "志望業界とのマッチ・ギャップをライト版で確認しました。";

        const { error: growthError } = await supabase
          .from("growth_logs")
          .insert({
            user_id: user.id,
            source: "career_gap",
            title,
            description,
            metadata: {
              thinking_type_id: thinkingTypeId,
              mode,
              desired_industries: desiredIndustryIds,
              career_gap_log_id: gapLogId ?? null,
            },
          });

        if (growthError) {
          console.error("growth_logs insert error (career_gap):", growthError);
        }
      }
    } catch (logErr) {
      console.error("career-gap logging error:", logErr);
    }

    // mode も返しておくとフロントで判別しやすい
    return NextResponse.json({ result: content, mode });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
