// proxy.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

const APP_MODE = process.env.NEXT_PUBLIC_APP_MODE || "production";
const IS_CLOSED_MODE = APP_MODE === "closed";

// middleware 用 Supabase クライアント
function createMiddlewareSupabase(req: NextRequest, res: NextResponse) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          res.cookies.set(name, value, options);
        },
        remove(name: string, options: CookieOptions) {
          res.cookies.set(name, "", { ...options, maxAge: 0 });
        },
      },
    }
  );
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 静的ファイル系はそのまま通す
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/robots.txt") ||
    pathname.startsWith("/sitemap.xml")
  ) {
    return NextResponse.next();
  }

  // closed モードでも見せてOKなページ
  const isPublicEvenWhenClosed =
    pathname === "/" ||
    pathname.startsWith("/legal") ||
    pathname.startsWith("/privacy") ||
    pathname.startsWith("/terms") ||
    pathname.startsWith("/service") ||
    pathname.startsWith("/pricing") ||
    pathname.startsWith("/api/webhooks") ||
    pathname.startsWith("/api");

  const isAuthRoute = pathname.startsWith("/auth");
  const isAuthRoot = pathname === "/auth";

  // 通常の「ログイン不要ルート」
  const isPublicRoute =
    pathname === "/" ||
    pathname.startsWith("/legal") ||
    pathname.startsWith("/privacy") ||
    pathname.startsWith("/terms") ||
    pathname.startsWith("/service") ||
    pathname.startsWith("/pricing") ||
    pathname.startsWith("/api/webhooks") ||
    pathname.startsWith("/api");

  // クローズドモード時のリダイレクト
  if (IS_CLOSED_MODE && !isPublicEvenWhenClosed) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // 認証付きのレスポンスを準備
  const res = NextResponse.next({
    request: {
      headers: req.headers,
    },
  });

  const supabase = createMiddlewareSupabase(req, res);

  const {
    data: { session },
  } = await supabase.auth.getSession();

  // 未ログイン & 認証必須ページ → /auth へ
  if (!session && !isAuthRoute && !isPublicRoute) {
    const url = req.nextUrl.clone();
    url.pathname = "/auth";
    url.searchParams.set("redirectedFrom", pathname);
    return NextResponse.redirect(url);
  }

  // ログイン済み & /auth 直下 → ホームへ
  if (session && isAuthRoot) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};
