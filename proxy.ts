// proxy.ts  ← ★ middleware.ts からリネームしてこれを使う！

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";

export async function proxy(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const { pathname } = req.nextUrl;

  // /auth 全体
  const isAuthRoute = pathname.startsWith("/auth");
  // ルートの /auth だけ
  const isAuthRoot = pathname === "/auth";

  // 🔓 ログイン不要で見せたい公開ページ
  const isPublicRoute =
    pathname.startsWith("/legal") ||
    pathname.startsWith("/privacy") ||
    pathname.startsWith("/terms") ||
    pathname.startsWith("/pricing") ||
    pathname.startsWith("/service") ||
    pathname.startsWith("/api");

  // 🔐 未ログイン → /auth（公開ページ除く）
  if (!session && !isAuthRoute && !isPublicRoute) {
    const url = req.nextUrl.clone();
    url.pathname = "/auth";
    url.searchParams.set("redirectedFrom", pathname);
    return NextResponse.redirect(url);
  }

  // 🔁 ログイン済みで /auth ルートに来た場合 → /
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
