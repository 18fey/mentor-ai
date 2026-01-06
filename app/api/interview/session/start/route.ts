// app/api/interview/start/route.ts
import { NextRequest, NextResponse } from "next/server";
import { checkMonthlyLimit, logUsage } from "@/lib/plan";
import { requireAuthUserId } from "@/lib/authServer";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    const userId = await requireAuthUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "unauthorized", message: "login required" },
        { status: 401 }
      );
    }

    const limit = await checkMonthlyLimit({
      userId,
      feature: "interview_10",
      freeLimit: 1,
    });

    if (!limit.allowed) {
      return NextResponse.json(
        {
          error: "limit_exceeded",
          plan: limit.plan,
          message:
            "無料プランでの一般面接AIの利用回数（今月1回まで）を使い切りました。PROプランにアップグレードすると無制限で利用できます。",
        },
        { status: 403 }
      );
    }

    // TODO: ここで session 作成など（body は userId 無しで使う）
    // const session = await createInterviewSession(userId, body);

    await logUsage(userId, "interview_10");

    return NextResponse.json({
      ok: true,
      plan: limit.plan,
      remaining: limit.remaining === Infinity ? Infinity : limit.remaining - 1,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
