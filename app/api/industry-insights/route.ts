// app/api/industry-insights/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { requireFeatureOrConsumeMeta } from "@/lib/payment/featureGate"; // ✅ interview-evalと同じ

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

type Database = any;

async function createSupabaseFromCookies() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
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

type InsightResult = {
  insight: string;
  questions: string;
  news: string;
};

function safeStr(v: unknown, maxLen: number) {
  if (typeof v !== "string") return "";
  return v.slice(0, maxLen);
}

export async function POST(req: Request) {
  try {
    // ✅ まず gate（interview-evalと同じノリ）
    // ここで無料枠 or META消費が確定する想定
    const gate = await requireFeatureOrConsumeMeta("industry_insight"); // ✅ typo禁止

    if (!gate.ok) {
      // gateが {status:402, requiredMeta, balance...} などを返す設計ならこれでUIに届く
      return NextResponse.json(
        {
          ok: false,
          reason: gate.reason,
          required: (gate as any).required ?? undefined,
          requiredMeta: (gate as any).requiredMeta ?? undefined,
          balance: (gate as any).balance ?? undefined,
        },
        { status: gate.status }
      );
    }

    if (!OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not set" },
        { status: 500 }
      );
    }

    // ✅ auth（cookieセッションで確定）
    const supabase = await createSupabaseFromCookies();
    const { data: auth, error: authErr } = await supabase.auth.getUser();
    const user = auth?.user ?? null;

    if (authErr || !user?.id) {
      return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
    }
    const authUserId = user.id;

    // ✅ 入力
    const body = (await req.json().catch(() => ({}))) as {
      industryGroup: string;
      industrySub?: string | null;
      targetCompany?: string | null;
      focusTopic?: string | null;
      includeNews?: boolean;
    };

    const industryGroup = safeStr(body.industryGroup, 80);
    const industrySub = safeStr(body.industrySub, 80) || null;
    const targetCompany = safeStr(body.targetCompany, 120) || null;
    const focusTopic = safeStr(body.focusTopic, 200) || null;
    const includeNews = Boolean(body.includeNews);

    if (!industryGroup) {
      return NextResponse.json(
        { error: "industryGroup is required" },
        { status: 400 }
      );
    }

    const industryLine = industrySub
      ? `対象業界: ${industryGroup} / ${industrySub}`
      : `対象業界: ${industryGroup}`;

    const companyPart = targetCompany
      ? `志望企業: ${targetCompany}`
      : "志望企業: 特に指定なし";

    const focusPart = focusTopic
      ? `特に深掘りしたいテーマ: ${focusTopic}`
      : "特に深掘りしたいテーマ: 特になし";

    const newsPart = includeNews
      ? "直近1〜2年のニュース・トレンドも整理してください。"
      : "ニュース・トレンドは簡潔で構いません。";

    const systemPrompt = `
あなたは日本の就活生向けに、
「業界構造 × 個別企業の強み/弱み × 将来性（中期リスク） × 直近トレンド」
を統合して整理するプロフェッショナルキャリアメンターです。

出力は必ず JSON 形式「のみ」で行ってください。前後に説明文は書かないでください。

JSON の形式は次の通りです：

{
  "insight": "業界構造・ビジネスモデル・個別企業の位置づけ・強み/弱み・将来性（Markdown 可）",
  "questions": "想定質問リストと答え方のポイント（Markdown 可）",
  "news": "直近ニュース・トレンドと面接での語り方（Markdown 可）"
}

・コードブロック（\`\`\`json など）で囲まず、純粋な JSON テキストだけを出力してください。
・「insight」「questions」「news」の3フィールドは必ず含めてください。
`.trim();

    const userPrompt = `
${industryLine}
${companyPart}
${focusPart}

要件:
- 就活の面接準備に直接使えるレベルで、できるだけ具体的に。
- 日本語で出力。
- 大学3〜4年生が読んで理解しやすいトーンで。
- "insight" / "questions" / "news" で、情報が被りすぎないようにしてください。
- insight では、業界構造（プレーヤー・収益源・規制・リスク）、主要論点、個別企業の位置づけに加えて、
  「強み」「弱み」「中期3〜5年の将来性（追い風・向かい風・構造的リスク）」も整理してください。
- questions では、面接で実際に聞かれそうな質問と、答え方のポイントを 10〜15 個まとめてください。
- news では、就活生が押さえておくべき直近トレンド・ニュースと、それをどう語るかのヒントを書いてください。
${newsPart}
`.trim();

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.55,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("OpenAI API error:", errText);
      return NextResponse.json({ error: "OpenAI API error" }, { status: 500 });
    }

    const json = await res.json();
    const content: string | null = json.choices?.[0]?.message?.content ?? null;

    if (!content) {
      return NextResponse.json({ error: "Empty content from OpenAI" }, { status: 500 });
    }

    let parsed: Partial<InsightResult>;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      console.error("JSON parse error:", e, content);
      return NextResponse.json({ error: "JSON parse error" }, { status: 500 });
    }

    const result: InsightResult = {
      insight: parsed.insight ?? "インサイト情報を取得できませんでした。",
      questions: parsed.questions ?? "想定質問情報を取得できませんでした。",
      news: parsed.news ?? "ニュース情報を取得できませんでした。",
    };

    // ✅ ログ（いったん現状維持）
    const nowIso = new Date().toISOString();

    // 1) usage_logs（※最終的には gate/usageに統一推奨）
    try {
      const { error } = await supabase.from("usage_logs").insert({
        user_id: authUserId,
        feature: "industry_insight",
        used_at: nowIso,
      });
      if (error) console.error("usage_logs insert error (industry-insights):", error);
    } catch (e) {
      console.error("usage_logs insert crash (industry-insights):", e);
    }

    // 2) growth_logs
    try {
      const { error } = await supabase.from("growth_logs").insert({
        user_id: authUserId,
        source: "industry_insight",
        title: `業界インサイト：${industryGroup}${industrySub ? ` / ${industrySub}` : ""}`,
        description: "業界構造・企業論点・想定質問・ニュース整理を生成しました。",
        metadata: {
          feature: "industry_insight",
          industryGroup,
          industrySub,
          targetCompany,
          focusTopic,
          includeNews,
        },
        created_at: nowIso,
      });
      if (error) console.error("growth_logs insert error (industry-insights):", error);
    } catch (e) {
      console.error("growth_logs insert crash (industry-insights):", e);
    }

    // 3) industry_research_logs
    try {
      const { error } = await supabase.from("industry_research_logs").insert({
        user_id: authUserId,
        industry_group: industryGroup,
        industry_sub: industrySub,
        target_company: targetCompany,
        focus_topic: focusTopic,
        include_news: includeNews,
        result,
        created_at: nowIso,
      });
      if (error) console.error("industry_research_logs insert error:", error);
    } catch (e) {
      console.error("industry_research_logs insert crash:", e);
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (error: any) {
    // gateがthrowする実装にも備える（interview-evalが握りつぶしてるのを改善）
    if (error?.status === 402 || error?.code === "NEED_META") {
      return NextResponse.json(
        {
          ok: false,
          error: "need_meta",
          requiredMeta: error?.requiredMeta ?? error?.required ?? 3,
          balance: error?.balance ?? null,
        },
        { status: 402 }
      );
    }

    console.error("Industry Insights API error:", error);
    return NextResponse.json({ error: "インサイト生成に失敗しました" }, { status: 500 });
  }
}
