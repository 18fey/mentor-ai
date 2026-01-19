// proxy.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

const APP_MODE = process.env.NEXT_PUBLIC_APP_MODE || "production";
const IS_CLOSED_MODE = APP_MODE === "closed";

// ✅ canonical（本番のみ強制）
const CANONICAL_HOST = "www.mentor-ai.net";

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

// ✅ res に積まれた cookie を redirect に引き継ぐ（Supabase refresh対策）
function redirectWithCookies(res: NextResponse, url: URL, status: 302 | 307 | 308 = 307) {
  const redirectRes = NextResponse.redirect(url, status);
  for (const c of res.cookies.getAll()) {
    redirectRes.cookies.set(c.name, c.value, c);
  }
  return redirectRes;
}

function isLocalhost(host: string) {
  return (
    host === "localhost" ||
    host.startsWith("localhost:") ||
    host === "127.0.0.1" ||
    host.startsWith("127.0.0.1:") ||
    host === "::1" ||
    host.startsWith("[::1]:")
  );
}

function isVercelPreview(host: string) {
  // preview / deployment domains
  return host.endsWith(".vercel.app") || host.includes("localhost");
}

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  const host = req.headers.get("host") ?? "";
  const proto = req.headers.get("x-forwarded-proto") ?? "http";

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

  // ✅ 本番の canonical 強制は「本番ホストで来たときだけ」適用
  // - localhost / preview を殺さない
  const shouldEnforceCanonical =
    !isLocalhost(host) && !isVercelPreview(host) && process.env.NODE_ENV === "production";

  if (shouldEnforceCanonical) {
    // 1) host が canonical でなければ寄せる
    if (host !== CANONICAL_HOST) {
      const url = req.nextUrl.clone();
      url.host = CANONICAL_HOST;
      url.protocol = "https";
      return NextResponse.redirect(url, 308);
    }

    // 2) proto が https でなければ寄せる（念のため）
    if (proto !== "https") {
      const url = req.nextUrl.clone();
      url.protocol = "https";
      return NextResponse.redirect(url, 308);
    }
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

  // ✅ 認証付きのレスポンスを準備（ここに Supabase が cookie を積む）
  const res = NextResponse.next({
    request: { headers: req.headers },
  });

  // ✅ DEBUG: Cookieが見えてるか（存在だけ確認）
  try {
    const cookieNames = req.cookies.getAll().map((c) => c.name);
    const sbCookies = cookieNames.filter((n) => n.includes("sb-") || n.includes("supabase"));
    console.log("[proxy middleware] cookies", {
      cookieCount: cookieNames.length,
      sbCookieCount: sbCookies.length,
      sbCookieNames: sbCookies.slice(0, 10),
    });
  } catch (e) {
    console.log("[proxy middleware] cookies read failed", String(e));
  }

  const supabase = createMiddlewareSupabase(req, res);

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  console.log("[proxy middleware] session", {
    pathname,
    hasSession: !!session,
    userId: session?.user?.id ?? null,
    err: sessionError ? String(sessionError) : null,
  });

  // ✅ クローズドモード時のリダイレクト（cookie引き継ぎ）
  if (IS_CLOSED_MODE && !isPublicEvenWhenClosed) {
    console.log("[proxy middleware] closed mode redirect", { pathname });
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return redirectWithCookies(res, url, 307);
  }

  // ✅ 未ログイン & 認証必須ページ → /auth（cookie引き継ぎ）
  if (!session && !isAuthRoute && !isPublicRoute) {
    console.log("[proxy middleware] redirect -> /auth (no session)", { pathname });
    const url = req.nextUrl.clone();
    url.pathname = "/auth";
    url.searchParams.set("redirectedFrom", pathname);
    return redirectWithCookies(res, url, 307);
  }

  // ✅ ログイン済み & /auth 直下 → /（cookie引き継ぎ）
  if (session && isAuthRoot) {
    console.log("[proxy middleware] redirect -> / (already logged in)", { pathname });
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return redirectWithCookies(res, url, 307);
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};
