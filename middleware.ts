// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const { pathname } = req.nextUrl;

  // /auth 全体
  const isAuthRoute = pathname.startsWith("/auth");
  // ルートの /auth だけを指すフラグ
  const isAuthRoot = pathname === "/auth";

  // ✅ ログイン不要で見せたい公開ページをここに全部並べる
  const isPublicRoute =
    pathname.startsWith("/legal") ||
    pathname.startsWith("/privacy") ||
    pathname.startsWith("/terms") ||
    pathname.startsWith("/pricing") ||
    pathname.startsWith("/service") ||
    pathname.startsWith("/api");

  // 🔐 未ログイン → /auth へリダイレクト（公開ページを除く）
  // /auth/* はログインしていなくても通す
  if (!session && !isAuthRoute && !isPublicRoute) {
    const url = req.nextUrl.clone();
    url.pathname = "/auth";
    url.searchParams.set("redirectedFrom", pathname);
    return NextResponse.redirect(url);
  }

  // ✅ ログイン済みで「/auth ルート」に来たときだけ / に戻す
  // /auth/callback や /auth/email-sent などはそのまま通す
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
