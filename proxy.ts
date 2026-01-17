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
  const { pathname, search } = req.nextUrl;

  // ✅ DEBUG: リクエスト到達確認（Vercelでも出るはず）
  const host = req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? "unknown";
  console.log("[proxy middleware] request", {
    pathname,
    search,
    host,
    proto,
  });

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
    console.log("[proxy middleware] closed mode redirect", { pathname });
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

  // ✅ DEBUG: Cookieが見えてるか（存在だけ確認）
  try {
    const cookieNames = req.cookies.getAll().map((c) => c.name);
    const sbCookies = cookieNames.filter((n) => n.includes("sb-") || n.includes("supabase"));
    console.log("[proxy middleware] cookies", {
      cookieCount: cookieNames.length,
      sbCookieCount: sbCookies.length,
      sbCookieNames: sbCookies.slice(0, 10), // 念のため上限
    });
  } catch (e) {
    console.log("[proxy middleware] cookies read failed", String(e));
  }

  const supabase = createMiddlewareSupabase(req, res);

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  // ✅ DEBUG: セッション取得結果
  console.log("[proxy middleware] session", {
    pathname,
    hasSession: !!session,
    userId: session?.user?.id ?? null,
    err: sessionError ? String(sessionError) : null,
  });

  // 未ログイン & 認証必須ページ → /auth へ
  if (!session && !isAuthRoute && !isPublicRoute) {
    console.log("[proxy middleware] redirect -> /auth (no session)", { pathname });
    const url = req.nextUrl.clone();
    url.pathname = "/auth";
    url.searchParams.set("redirectedFrom", pathname);
    return NextResponse.redirect(url);
  }

  // ログイン済み & /auth 直下 → ホームへ
  if (session && isAuthRoot) {
    console.log("[proxy middleware] redirect -> / (already logged in)", { pathname });
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};
