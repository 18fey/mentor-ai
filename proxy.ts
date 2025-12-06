// proxy.ts

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";

// APP_MODE を環境変数から取得（"production" / "classroom" / "closed"）
const APP_MODE = process.env.NEXT_PUBLIC_APP_MODE || "production";
const IS_CLOSED_MODE = APP_MODE === "closed";

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 🔓 closed モードでも見せてOKなページ（必要に応じて調整してね）
  const isPublicEvenWhenClosed =
    pathname.startsWith("/legal") ||
    pathname.startsWith("/privacy") ||
    pathname.startsWith("/terms") ||
    pathname.startsWith("/service") ||
    pathname.startsWith("/api");

  // 🔒 APP_MODE === "closed" のとき：
  // ルート("/") 以外＆上の公開ページ以外はすべて "/" に飛ばす
  // → "/" の page.tsx 側で APP_MODE === "closed" を見てクローズ画面を表示
  if (IS_CLOSED_MODE && pathname !== "/" && !isPublicEvenWhenClosed) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // ここから下は「通常モード（production / classroom）のときだけ」効く

  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const isAuthRoute = pathname.startsWith("/auth");
  const isAuthRoot = pathname === "/auth";

  // ✅ ログイン不要で見せたい公開ページ
  const isPublicRoute =
    pathname.startsWith("/legal") ||
    pathname.startsWith("/privacy") ||
    pathname.startsWith("/terms") ||
    pathname.startsWith("/pricing") ||
    pathname.startsWith("/service") ||
    pathname.startsWith("/api");

  // 🔐 未ログイン → /auth へリダイレクト（公開ページを除く）
  if (!session && !isAuthRoute && !isPublicRoute) {
    const url = req.nextUrl.clone();
    url.pathname = "/auth";
    url.searchParams.set("redirectedFrom", pathname);
    return NextResponse.redirect(url);
  }

  // ✅ ログイン済みで「/auth ルート」に来たときだけ / に戻す
  if (session && isAuthRoot) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
