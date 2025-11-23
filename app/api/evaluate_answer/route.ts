// app/api/evaluate_answer/route.ts
import { NextResponse } from "next/server";
import personasConfig from "@/config/personas.json";
import scoringConfig from "@/config/scoring_config.json";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

type Persona = (typeof personasConfig)["personas"][number];

type RequestBody = {
  persona_id?: string;
  question_id?: string;
  transcript: string;
  total_duration_sec?: number;
  speech_duration_sec?: number;
  filler_count?: number;
  wpm?: number;
};

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
    one_sentence_advice: "一番伝えたいメッセージを最初に置き、そこに向けてSTARで話しましょう。",
  },
};

function findPersona(personaId?: string): Persona {
  const list = personasConfig.personas as Persona[];
  const found =
    (personaId && list.find((p) => p.id === personaId)) || list[0];
  return found;
}

export async function POST(req: Request) {
  try {
    if (!OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not set" },
        { status: 500 }
      );
    }

    const body = (await req.json()) as RequestBody;

    if (!body.transcript || !body.transcript.trim()) {
      return NextResponse.json(
        { error: "transcript is required" },
        { status: 400 }
      );
    }

    const persona = findPersona(body.persona_id);

    const metricsText = [
      body.total_duration_sec != null
        ? `・回答の長さ: 約 ${body.total_duration_sec.toFixed(
            1
          )} 秒（サイレント含む）`
        : null,
      body.speech_duration_sec != null
        ? `・実際に話していた時間: 約 ${body.speech_duration_sec.toFixed(
            1
          )} 秒`
        : null,
      body.wpm != null ? `・WPM（1分あたりの語数）: 約 ${body.wpm}` : null,
      body.filler_count != null
        ? `・フィラー（えっと／そのー 等）の回数: ${body.filler_count}`
        : null,
    ]
      .filter(Boolean)
      .join("\n");

    const criteriaDescription = scoringConfig.criteria
      .map(
        (c: any) =>
          `- ${c.id} (${c.label}): weight=${c.weight} / ${c.description}`
      )
      .join("\n");

    const systemPrompt = [
      persona.system_prompt,
      "",
      "あなたは上記の人格で、候補者の単一回答を評価する役割です。",
      "出力は必ず JSON 形式のみで返してください（日本語）。",
      "JSON 以外のテキストは一切書かないでください。",
      "",
      "スコアリング仕様:",
      criteriaDescription,
      "",
      "total_score は 0〜100 の範囲で、各スコアと整合的な値にしてください。",
    ].join("\n");

    const userPrompt = `
以下は候補者の1つの回答です。

【質問ID】${body.question_id ?? "不明"}
【回答内容（文字起こし）】
${body.transcript}

【話し方に関するメタ情報】
${metricsText || "（メタ情報はありません）"}

この回答をもとに、以下の形式の JSON を日本語で返してください。

{
  "total_score": number,              // 0〜100
  "star_score": number,               // 0〜100
  "content_depth_score": number,      // 0〜100
  "clarity_score": number,            // 0〜100
  "delivery_score": number,           // 0〜100
  "auto_feedback": {
    "good_points": string[],          // 箇条書きで3点程度
    "improvement_points": string[],   // 箇条書きで3点程度
    "one_sentence_advice": string     // 一言アドバイス（1〜2文）
  }
}

注意:
- 候補者にとってわかりやすい言葉で書いてください。
- 厳しめの評価でも構いませんが、必ず前向きなトーンを維持してください。
`;

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
      console.error("evaluate_answer OpenAI error:", errText);
      return NextResponse.json(DEFAULT_RESULT, { status: 200 });
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;

    let parsed: EvaluationResult = DEFAULT_RESULT;

    if (content) {
      try {
        parsed = JSON.parse(content);
      } catch (e) {
        console.error("JSON parse error (evaluate_answer):", e, content);
      }
    }

    const safe: EvaluationResult = {
      ...DEFAULT_RESULT,
      ...parsed,
      auto_feedback: {
        ...DEFAULT_RESULT.auto_feedback,
        ...(parsed.auto_feedback ?? {}),
      },
    };

    return NextResponse.json(safe);
  } catch (e: any) {
    console.error("evaluate_answer route error:", e);
    return NextResponse.json(DEFAULT_RESULT, { status: 200 });
  }
}
