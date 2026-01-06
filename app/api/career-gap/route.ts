import { NextResponse } from "next/server";
import {
  CAREER_FIT_MAP,
  INDUSTRIES,
  IndustryId,
  FitSymbol,
  ThinkingTypeId,
} from "@/lib/careerFitMap";
import { requireFeatureOrConsumeMeta } from "@/lib/payment/featureGate";
import { createServerSupabase } from "@/utils/supabase/server";

const FIT_SYMBOL_DESC: Record<FitSymbol, string> = {
  "◎": "とても相性が良い（タイプの強みと業界の求める力がかなり重なる）",
  "○": "概ね相性が良い（一部ギャップはあるが、戦い方次第で十分戦える）",
  "△": "工夫すれば活かせる（前提を理解しておかないとしんどくなりやすい）",
  "✕": "かなりギャップが大きい（強い動機・環境/企業選びの工夫が必要）",
};

const SYSTEM_PROMPT_BASIC = `
あなたは就活生向けのキャリアコーチです。
ライト（無料）として、**1分で方向性がわかる**簡潔なフィードバックを行ってください。
難しい専門用語は避け、冗長にしないことを最優先してください。

【出力フォーマット（厳守 / Markdown）】
# ライト（無料）キャリア相性メモ

## 1. 結論（1行）
- マッチ度: 「◎ / ○ / △ / ✕」のいずれか + 一言

## 2. 活きる強み（3つ）
- 箇条書き3つ（短く）

## 3. つまずきやすいギャップ（3つ）
- 箇条書き3つ（“こういう癖だとしんどい” の言い方）

## 4. 次のアクション（5つ）
- 箇条書き5つ（今日からできる粒度）
`;

const SYSTEM_PROMPT_DEEP = `
あなたは就活生向けのキャリアコーチです。
Deep（有料）として、**最大3業界を比較**し、
ギャップの埋め方・勝ち筋・企業選びの軸・ES/面接の見せ方・3ヶ月アクションまで踏み込んでください。

【必須観点】
- 業界ごとの「勝ちやすさ（戦える土俵）」と理由
- 攻め（伸ばす）/ 守り（補う）で分けた戦い方
- ES：どこを深掘るべきか、構成の示唆
- 面接：聞かれやすい問いと返し方の方針
- 次にアプリで何を使うべきか（例：業界インサイト/ES添削/ケース/フェルミ）を明示
`;

type Body = {
  thinkingTypeId?: string;
  thinkingTypeNameJa?: string;
  thinkingTypeNameEn?: string;
  typeDescription?: string;
  desiredIndustryIds?: IndustryId[];
  userReason?: string;
  userExperienceSummary?: string;
  mode?: "basic" | "deep";
};

// profiles に保存する mode（UI表示用）
type SavedCareerGapMode = "lite" | "deep";

export async function POST(req: Request) {
  try {
    // ✅ サーバー側Supabase（cookie連携）
    const supabase = await createServerSupabase();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as Body;

    const thinkingTypeId = String(body.thinkingTypeId || "");
    if (!thinkingTypeId) {
      return NextResponse.json(
        { error: "thinkingTypeId is required" },
        { status: 400 }
      );
    }

    const mode: "basic" | "deep" = body.mode === "deep" ? "deep" : "basic";

    const raw = Array.isArray(body.desiredIndustryIds)
      ? body.desiredIndustryIds
      : [];
    if (raw.length === 0) {
      return NextResponse.json(
        { error: "desiredIndustryIds is required" },
        { status: 400 }
      );
    }

    // basic=1業界 / deep=最大3業界
    const desiredIndustryIds =
      mode === "deep" ? raw.slice(0, 3) : raw.slice(0, 1);

    // Deepは課金ゲート（402返す）
    if (mode === "deep") {
      const gate = await requireFeatureOrConsumeMeta("career_gap_deep");
      if (!gate.ok) {
        return NextResponse.json(gate, { status: gate.status });
      }
    }

    const thinkingTypeNameJa = body.thinkingTypeNameJa ?? "";
    const thinkingTypeNameEn = body.thinkingTypeNameEn ?? "";
    const typeDescription = body.typeDescription ?? "";
    const userReason = body.userReason ?? "";
    const userExperienceSummary = body.userExperienceSummary ?? "";

    const fitMap = CAREER_FIT_MAP[thinkingTypeId as ThinkingTypeId] ?? null;

    const industryFitLines = fitMap
      ? Object.entries(fitMap)
          .map(([id, symbol]) => {
            const meta = INDUSTRIES.find((i) => i.id === id);
            const labelJa = meta?.labelJa ?? id;
            const desc = FIT_SYMBOL_DESC[symbol as FitSymbol] ?? "";
            return `- ${id}（${labelJa}）: ${symbol} ${desc}`;
          })
          .join("\n")
      : "（この ThinkingTypeId の業界相性マップはまだ未定義です）";

    const desiredIndustryLines = desiredIndustryIds
      .map((id, idx) => {
        const meta = INDUSTRIES.find((i) => i.id === id);
        return `${idx + 1}. ${id}（${meta?.labelJa ?? id}）`;
      })
      .join("\n");

    const userPrompt = `
[Thinking Type]
ID: ${thinkingTypeId}
Name: ${thinkingTypeNameJa} / ${thinkingTypeNameEn}

[Type Description]
${typeDescription}

[Industry Fit Map for this Type]
${industryFitLines}

[Desired Industries]
${desiredIndustryLines}

[User Context]
- 志望理由:
${userReason || "（未入力）"}

- 経験サマリ:
${userExperienceSummary || "（未入力）"}

▼タスク
${mode === "deep" ? "Deep（有料）として詳しく。" : "ライト（無料）として短く・明確に。"}
`.trim();

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
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
        temperature: mode === "deep" ? 0.7 : 0.5,
        max_tokens: mode === "deep" ? 2400 : 650,
        messages: [
          {
            role: "system",
            content: mode === "deep" ? SYSTEM_PROMPT_DEEP : SYSTEM_PROMPT_BASIC,
          },
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
    const content = data.choices?.[0]?.message?.content ?? "生成に失敗しました。";

    // ✅ ここが本丸：成功したら「次の実行まで固定」するため profiles に保存（上書き）
    // - basic -> lite / deep -> deep
    const savedMode: SavedCareerGapMode = mode === "deep" ? "deep" : "lite";
    const nowISO = new Date().toISOString();

    // profiles のキーが環境で違っても落ちないように、まず id、それでダメなら auth_user_id を試す
    const { data: updatedById, error: updErr1 } = await supabase
      .from("profiles")
      .update({
        career_gap_mode: savedMode,
        career_gap_result: content,
        career_gap_updated_at: nowISO,
      })
      .eq("id", user.id)
      .select("id")
      .maybeSingle();

    if (updErr1) {
      console.error("profiles update error (by id):", updErr1);
    }

    if (!updatedById && !updErr1) {
      const { error: updErr2 } = await supabase
        .from("profiles")
        .update({
          career_gap_mode: savedMode,
          career_gap_result: content,
          career_gap_updated_at: nowISO,
        })
        .eq("auth_user_id", user.id);

      if (updErr2) {
        console.error("profiles update error (by auth_user_id):", updErr2);
      }
    }

    // ✅ growth_logs にも記録（履歴）
    const { error: logErr } = await supabase.from("growth_logs").insert({
      user_id: user.id,
      source: "career_gap",
      title: "キャリアマッチ診断を実施",
      description:
        savedMode === "deep" ? "Deep版（最大3業界比較）" : "ライト版（1業界）",
      metadata: {
        mode: savedMode,
        thinkingTypeId,
        usedIndustryIds: desiredIndustryIds,
      },
    });

    if (logErr) {
      // ログ失敗してもレポートは返す（UX優先）
      console.error("growth_logs insert error:", logErr);
    }

    return NextResponse.json({
      result: content,
      mode,
      usedIndustryIds: desiredIndustryIds,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
