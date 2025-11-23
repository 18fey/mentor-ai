import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export const runtime = "nodejs"; // Buffer を使うので node 実行

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);

    if (!body) {
      return NextResponse.json(
        {
          ok: false,
          error: "invalid_body",
          message: "JSON のパースに失敗しました",
        },
        { status: 400 }
      );
    }

    // userId は「Supabase Auth の user.id」を想定（今はフロントから文字列で送る）
    const { token, amount, userId } = body as {
      token?: string;
      amount?: number;
      userId?: string; // auth_user_id 想定
    };

    if (!token || !amount) {
      return NextResponse.json(
        {
          ok: false,
          error: "missing_params",
          message: "token と amount は必須です",
        },
        { status: 400 }
      );
    }

    const secretKey = process.env.PAYJP_SECRET_KEY;
    if (!secretKey) {
      console.error("PAYJP_SECRET_KEY is not set");
      return NextResponse.json(
        {
          ok: false,
          error: "missing_secret_key",
          message: "PAYJP_SECRET_KEY が未設定です",
        },
        { status: 500 }
      );
    }

    // --- PAY.JP 決済 ---------------------------------
    const basicAuth = Buffer.from(`${secretKey}:`).toString("base64");

    const params = new URLSearchParams();
    params.append("amount", String(amount));
    params.append("currency", "jpy");
    params.append("card", token);
    params.append("description", "Mentor.AI PROテスト決済");

    const payjpRes = await fetch("https://api.pay.jp/v1/charges", {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const payjpText = await payjpRes.text();
    let payjpData: any;
    try {
      payjpData = JSON.parse(payjpText);
    } catch {
      payjpData = { raw: payjpText };
    }

    if (!payjpRes.ok) {
      console.error("PAY.JP ERROR:", payjpRes.status, payjpData);
      return NextResponse.json(
        {
          ok: false,
          error: "payjp_error",
          status: payjpRes.status,
          detail: payjpData,
        },
        { status: 500 }
      );
    }

    // --- Supabase 側のプラン更新（SDK 版）-----------------
    if (userId) {
      try {
        const { error: planError } = await supabaseServer
          .from("users_profile")
          .update({
            plan: "beta", // ★ βプラン
            plan_started_at: new Date().toISOString(),
            beta_user: true, // ★ βユーザーフラグ ON
          })
          .eq("auth_user_id", userId);

        if (planError) {
          console.error("Supabase plan update error:", planError);
        }
      } catch (e) {
        console.error("Supabase plan update exception:", e);
      }
    } else {
      console.warn(
        "[pay/charge] userId(auth_user_id) が渡っていないため、プラン更新をスキップしました"
      );
    }

    // --- 最終レスポンス --------------------------------
    return NextResponse.json(
      {
        ok: true,
        chargeId: payjpData.id,
        status: payjpData.status,
      },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("Charge API failure:", e);
    return NextResponse.json(
      {
        ok: false,
        error: "server_error",
        message: e?.message || "unknown error",
      },
      { status: 500 }
    );
  }
}
