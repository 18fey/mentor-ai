// app/api/recommendations/next-actions/route.ts
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

type NextAction = {
  title: string;
  reason: string;
  href: string;
  badge?: string;
  feature?: string;
};

export async function GET() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // ✅ get(name) ではなく getAll/setAll を使う（型エラー回避）
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          // Next.js の Route Handler では set できる想定
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );

  // ✅ getUser の返り値の取り方を修正
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr || !user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // 1) profile 取得（パーソナライズ材料をまとめて取る）
  const { data: profile, error: pErr } = await supabase
    .from("profiles")
    .select(
      `
      onboarding_completed,
      first_run_completed,
      ai_type_key,
      interests,
      target_companies,
      job_stage,
      work_industry,
      work_role,
      ai_strengths,
      ai16_axis_score,
      plan
    `
    )
    .eq("id", user.id)
    .maybeSingle();

  if (pErr || !profile) {
    return NextResponse.json({ ok: false, error: "profile_not_found" }, { status: 400 });
  }

  if (!profile.onboarding_completed) {
    return NextResponse.json({
      ok: true,
      actions: [
        {
          title: "プロフィールを完成させる",
          reason: "提案の精度を上げるために必要です。",
          href: "/onboarding",
          badge: "最優先",
          feature: "onboarding",
        },
      ],
    });
  }

  if (!profile.first_run_completed) {
    return NextResponse.json({
      ok: true,
      actions: [
        {
          title: "スタートガイドを完了する",
          reason: "最初のセットアップを終えると提案がパーソナライズされます。",
          href: "/start",
          badge: "最優先",
          feature: "start",
        },
      ],
    });
  }

  // 2) STEP3〜5 判定（現行ロジック）
  const hasAnyLog = async (sources: string[]) => {
    const { data, error } = await supabase
      .from("growth_logs")
      .select("id")
      .eq("user_id", user.id)
      .in("source", sources)
      .limit(1);

    if (error) {
      console.error("hasAnyLog error:", error);
      return false;
    }
    return (data?.length ?? 0) > 0;
  };

  const [step3, step4, step5] = await Promise.all([
    hasAnyLog(["interview_10"]),
    hasAnyLog(["es_draft", "es_correction"]),
    hasAnyLog(["career_gap"]),
  ]);

  // 3) 直近ログ
  const { data: logs, error: logsErr } = await supabase
    .from("growth_logs")
    .select("source,created_at,title")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (logsErr) console.error("growth_logs fetch error:", logsErr);

  const last = logs?.[0];

  // 4) Next actions
  const actions = buildNextActions({
    profile,
    step3,
    step4,
    step5,
    lastSource: last?.source ?? null,
    lastAt: last?.created_at ?? null,
  });

  return NextResponse.json({
    ok: true,
    actions,
    ...(process.env.NODE_ENV !== "production"
      ? {
          debug: {
            signals: {
              step3,
              step4,
              step5,
              lastSource: last?.source,
              target_companies: profile.target_companies,
              job_stage: profile.job_stage,
            },
          },
        }
      : {}),
  });
}

// ---- 推奨：ここは別ファイルに切り出して育てる
function buildNextActions(params: {
  profile: any;
  step3: boolean;
  step4: boolean;
  step5: boolean;
  lastSource: string | null;
  lastAt: string | null;
}): NextAction[] {
  const { profile, step3, step4, step5, lastSource } = params;

  if (!step3) {
    return [
      {
        title: "一般面接（10問）を1セッションだけ終える（10〜15分）",
        reason: "まずは“話す→素材化”が最短。ES/面接が一気に進みます。",
        href: "/general",
        badge: "最優先",
        feature: "interview_10",
      },
      {
        title: "プロフィールを最新の志望に更新する（3分）",
        reason: "志望企業・志望業界を入れるほど提案が刺さります。",
        href: "/profile",
        feature: "profile",
      },
    ];
  }

  if (!step4) {
    const hasTargets =
      Array.isArray(profile.target_companies) && profile.target_companies.length > 0;

    return [
      {
        title: "ESを1本作る（ドラフト or 添削）",
        reason: hasTargets
          ? "志望企業が入っているので、企業別に刺さる言い回しへ寄せられます。"
          : "面接素材がある今が一番“成果物化”しやすいです。",
        href: "/es",
        badge: "おすすめ",
        feature: "es",
      },
      {
        title: "一般面接ログから“ガクチカの骨格”を1つ固定する",
        reason: "ESの再現性が上がります（型が決まると量産できます）。",
        href: "/general",
        feature: "interview_10",
      },
    ];
  }

  if (!step5) {
    return [
      {
        title: "キャリアマッチ診断で、志望とのギャップと打ち手を出す",
        reason: "土台が揃ってきたので、次は“戦い方の最適化”が効きます。",
        href: "/diagnosis-16type",
        badge: "おすすめ",
        feature: "career_gap",
      },
      {
        title: "プロフィールに志望業界・職種を入れる（未入力なら）",
        reason: "マッチ診断と提案の精度が跳ねます。",
        href: "/profile",
        feature: "profile",
      },
    ];
  }

  const industry = String(profile.work_industry ?? "").toLowerCase();
  const role = String(profile.work_role ?? "").toLowerCase();

  const consultLike = industry.includes("consult") || role.includes("consult");
  const financeLike = industry.includes("finance") || role.includes("ib") || role.includes("bank");

  if (consultLike) {
    return [
      {
        title: "ケース面接AIを1問だけ解く（15分）",
        reason:
          "志望がコンサル寄りなら、最短で評価が上がるのは“構造化→仮説→数字”です。",
        href: "/case",
        badge: lastSource === "case" ? "継続" : "おすすめ",
        feature: "case",
      },
      {
        title: "ESを志望先の“評価軸”に合わせて1点だけ直す",
        reason: "ケースの論理とESの論理を揃えると通過率が上がります。",
        href: "/es",
        feature: "es",
      },
    ];
  }

  if (financeLike) {
    return [
      {
        title: "一般面接（10問）で“志望動機”だけ深掘りする",
        reason:
          "金融/IBは“なぜこの業界・なぜこの会社・なぜ自分”の整合性で差がつきます。",
        href: "/general",
        badge: "おすすめ",
        feature: "interview_10",
      },
      {
        title: "ESを企業別に出し分ける（1社だけ）",
        reason: "志望企業があるなら、1社に寄せたESを作るのが最短です。",
        href: "/es",
        feature: "es",
      },
    ];
  }

  return [
    {
      title: "企業研究で、志望業界の“評価される型”を掴む",
      reason: "直近の行動に合わせて、勝ち筋を先に押さえると全体が速くなります。",
      href: "/industry",
      feature: "industry",
    },
    {
      title: "AI思考力トレーニングを1タスクだけ（ウォームアップ）",
      reason: "軽く整えると、その後のES/面接の出力が安定します。",
      href: "/mentor-ai-index",
      feature: "ai_training",
    },
  ];
}
