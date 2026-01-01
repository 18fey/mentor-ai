// app/api/interview-eval/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import personasConfig from "@/config/personas.json";
import scoringConfig from "@/config/scoring_config.json";
import { requireFeatureOrConsumeMeta } from "@/lib/payment/featureGate"; // ✅ “課金の真実” はAPI側で

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

type QA = { question: string; answer: string };
type Persona = (typeof personasConfig)["personas"][number];

type EvaluationResult = {
  total_score: number;
  star_score: number;
  content_depth_score: number;
  clarity_score: number;
  delivery_score: number;
  auto_feedback: {
    good_points: string[];
    improvement_points: string[];
    one_sentence_advice: string;
  };
};

const DEFAULT_RESULT: EvaluationResult = {
  total_score: 60,
  star_score: 60,
  content_depth_score: 60,
  clarity_score: 60,
  delivery_score: 60,
  auto_feedback: {
    good_points: ["全体として分かりやすく整理して話せています。"],
    improvement_points: [
      "具体例や数字をもう一歩踏み込んで伝えると、説得力がさらに増します。",
    ],
    one_sentence_advice:
      "一番伝えたいメッセージを最初に置き、そこに向けてSTARで話しましょう。",
  },
};

function findPersona(personaId?: string): Persona {
  const list = personasConfig.personas as Persona[];
  return (personaId && list.find((p) => p.id === personaId)) || list[0];
}

function safeStr(v: unknown, maxLen: number) {
  if (typeof v !== "string") return "";
  return v.slice(0, maxLen);
}

function toSafeEval(parsed: any): EvaluationResult {
  const safe: EvaluationResult = {
    ...DEFAULT_RESULT,
    ...(parsed ?? {}),
    auto_feedback: {
      ...DEFAULT_RESULT.auto_feedback,
      ...((parsed?.auto_feedback ?? {}) as any),
    },
  };

  const clamp = (n: any) => {
    const x = Number(n);
    if (!Number.isFinite(x)) return 60;
    return Math.max(0, Math.min(100, Math.round(x)));
  };

  return {
    ...safe,
    total_score: clamp(safe.total_score),
    star_score: clamp(safe.star_score),
    content_depth_score: clamp(safe.content_depth_score),
    clarity_score: clamp(safe.clarity_score),
    delivery_score: clamp(safe.delivery_score),
    auto_feedback: {
      good_points: Array.isArray(safe.auto_feedback.good_points)
        ? safe.auto_feedback.good_points
        : DEFAULT_RESULT.auto_feedback.good_points,
      improvement_points: Array.isArray(safe.auto_feedback.improvement_points)
        ? safe.auto_feedback.improvement_points
        : DEFAULT_RESULT.auto_feedback.improvement_points,
      one_sentence_advice:
        typeof safe.auto_feedback.one_sentence_advice === "string"
          ? safe.auto_feedback.one_sentence_advice
          : DEFAULT_RESULT.auto_feedback.one_sentence_advice,
    },
  };
}

export async function POST(req: Request) {
  try {
    // ✅ まず featureGate（課金の真実）
    const gate = await requireFeatureOrConsumeMeta("interview_10");
    if (!gate.ok) {
      return NextResponse.json(
        {
          ok: false,
          reason: gate.reason,
          required: gate.required ?? undefined,
        },
        { status: gate.status }
      );
    }

    if (!OPENAI_API_KEY) {
      console.error("OPENAI_API_KEY is not set");
    }

    const supabase = await createSupabaseFromCookies();
    const { data: auth, error: authErr } = await supabase.auth.getUser();
    const user = auth?.user ?? null;

    if (authErr || !user?.id) {
      return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
    }
    const authUserId = user.id;

    const body = (await req.json().catch(() => ({}))) as {
      qaList?: QA[];
      persona_id?: string;
      topic?: string;
      is_sensitive?: boolean;
    };

    const qaList: QA[] = Array.isArray(body.qaList) ? body.qaList : [];
    const personaId =
      typeof body.persona_id === "string" ? body.persona_id : undefined;
    const topic = safeStr(body.topic, 120) || "一般面接";
    const isSensitive = Boolean(body.is_sensitive);

    if (!qaList.length) {
      return NextResponse.json({ error: "qaList is required" }, { status: 400 });
    }

    const persona = findPersona(personaId);

    const interviewLog = qaList
      .map(
        (qa, idx) =>
          `Q${idx + 1}: ${safeStr(qa.question, 2000)}\nA${idx + 1}: ${
            safeStr(qa.answer, 4000) || "（無回答）"
          }`
      )
      .join("\n\n");

    const criteriaDescription = (scoringConfig as any).criteria
      .map(
        (c: any) => `- ${c.id} (${c.label}): weight=${c.weight} / ${c.description}`
      )
      .join("\n");

    const systemPrompt = [
      persona.system_prompt,
      "",
      "あなたは上記の人格で、候補者の模擬面接全体を評価する役割です。",
      "出力は必ず JSON 形式のみで返してください（日本語）。",
      "JSON 以外のテキストは一切書かないでください。",
      "",
      "スコアリング仕様:",
      criteriaDescription,
      "",
      "total_score は 0〜100 の範囲で、各スコアと整合的な値にしてください。",
    ].join("\n");

    const userPrompt = `
以下は候補者との模擬面接（一般質問×最大10問）のログです。

${interviewLog}

このログをもとに、以下の形式の JSON を日本語で返してください。

{
  "total_score": number,
  "star_score": number,
  "content_depth_score": number,
  "clarity_score": number,
  "delivery_score": number,
  "auto_feedback": {
    "good_points": string[],
    "improvement_points": string[],
    "one_sentence_advice": string
  }
}

注意:
- 候補者にとってわかりやすい言葉で書いてください。
- 厳しめの評価でも構いませんが、必ず前向きなトーンを維持してください。
`.trim();

    let safeEval: EvaluationResult = DEFAULT_RESULT;

    if (OPENAI_API_KEY) {
      try {
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
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
          }),
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => "");
          console.error("interview-eval OpenAI error:", errText);
        } else {
          const data = await res.json();
          const content = data?.choices?.[0]?.message?.content;

          if (content) {
            try {
              const parsed = JSON.parse(content);
              safeEval = toSafeEval(parsed);
            } catch (e) {
              console.error("JSON parse error (interview-eval):", e, content);
            }
          }
        }
      } catch (e) {
        console.error("OpenAI call crash (interview-eval):", e);
      }
    }

    const nowIso = new Date().toISOString();

    // 1) usage_logs（横串）
    try {
      const { error } = await supabase.from("usage_logs").insert({
        user_id: authUserId,
        feature: "interview_10",
        used_at: nowIso,
      });
      if (error) console.error("usage_logs insert error (interview-eval):", error);
    } catch (e) {
      console.error("usage_logs insert crash (interview-eval):", e);
    }

    // 2) growth_logs（タイムライン）
    try {
      const { error } = await supabase.from("growth_logs").insert({
        user_id: authUserId,
        source: "interview",
        title: `面接評価：${topic}`,
        description: "模擬面接の回答を評価し、フィードバックを生成しました。",
        metadata: {
          feature: "interview_10",
          persona_id: personaId ?? null,
          topic,
          scores: {
            total: safeEval.total_score,
            star: safeEval.star_score,
            content_depth: safeEval.content_depth_score,
            clarity: safeEval.clarity_score,
            delivery: safeEval.delivery_score,
          },
        },
        created_at: nowIso,
      });
      if (error) console.error("growth_logs insert error (interview-eval):", error);
    } catch (e) {
      console.error("growth_logs insert crash (interview-eval):", e);
    }

    // 3) 面接DB（既存テーブル）
    try {
      const { data: session, error: sessionErr } = await supabase
        .from("interview_sessions")
        .insert({
          user_id: authUserId,
          topic,
          is_sensitive: isSensitive,
          created_at: nowIso,
        })
        .select("id")
        .single();

      if (sessionErr) {
        console.error("interview_sessions insert error:", sessionErr);
      } else {
        const sessionId = session?.id;

        const turns = qaList
          .flatMap((qa) => {
            const q = safeStr(qa.question, 2000);
            const a = safeStr(qa.answer, 4000);
            return [
              { role: "question", message: q },
              { role: "answer", message: a || "（無回答）" },
            ];
          })
          .map((t) => ({
            session_id: sessionId,
            user_id: authUserId,
            role: t.role,
            message: t.message,
            is_sensitive: isSensitive,
            created_at: nowIso,
          }));

        const { error: turnsErr } = await supabase.from("interview_turns").insert(turns);
        if (turnsErr) console.error("interview_turns insert error:", turnsErr);

        const { error: logsErr } = await supabase.from("interview_logs").insert({
          user_id: authUserId,
          qas: qaList,
          score: Math.round(safeEval.total_score),
          created_at: nowIso,
        });
        if (logsErr) console.error("interview_logs insert error:", logsErr);
      }
    } catch (e) {
      console.error("interview tables insert crash:", e);
    }

    return NextResponse.json(safeEval);
  } catch (e: any) {
    console.error("interview-eval route error:", e);
    return NextResponse.json(DEFAULT_RESULT, { status: 200 });
  }
}
