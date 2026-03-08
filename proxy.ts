// proxy.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

const APP_MODE = process.env.NEXT_PUBLIC_APP_MODE || "production";
const IS_CLOSED_MODE = APP_MODE === "closed";

// canonical（本番のみ強制）
const CANONICAL_HOST = "www.mentor-ai.net";

// const TERMS_VERSION = "2025-12-02";

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

function redirectWithCookies(
  res: NextResponse,
  url: URL,
  status: 302 | 307 | 308 = 307
) {
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
  return host.endsWith(".vercel.app") || host.includes("localhost");
}

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  const host = req.headers.get("host") ?? "";
  const proto = req.headers.get("x-forwarded-proto") ?? "http";

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/robots.txt") ||
    pathname.startsWith("/sitemap.xml")
  ) {
    return NextResponse.next();
  }

  const shouldEnforceCanonical =
    !isLocalhost(host) && !isVercelPreview(host) && process.env.NODE_ENV === "production";

  if (shouldEnforceCanonical) {
    if (host !== CANONICAL_HOST) {
      const url = req.nextUrl.clone();
      url.host = CANONICAL_HOST;
      url.protocol = "https";
      return NextResponse.redirect(url, 308);
    }

    if (proto !== "https") {
      const url = req.nextUrl.clone();
      url.protocol = "https";
      return NextResponse.redirect(url, 308);
    }
  }

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
  const isLegalConfirmRoute = pathname.startsWith("/legal/confirm");

  const isPublicRoute =
    pathname === "/" ||
    pathname.startsWith("/legal") ||
    pathname.startsWith("/privacy") ||
    pathname.startsWith("/terms") ||
    pathname.startsWith("/service") ||
    pathname.startsWith("/pricing") ||
    pathname.startsWith("/api/webhooks") ||
    pathname.startsWith("/api");

  const res = NextResponse.next({
    request: { headers: req.headers },
  });

  const supabase = createMiddlewareSupabase(req, res);

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  console.log("[proxy]", {
    pathname,
    search,
    isAuthRoute,
    isPublicRoute,
    hasSession: !!session,
    sessionUserId: session?.user?.id ?? null,
    sessionError: sessionError?.message ?? null,
  });

  if (IS_CLOSED_MODE && !isPublicEvenWhenClosed) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return redirectWithCookies(res, url, 307);
  }

  if (!session && !isAuthRoute && !isPublicRoute) {
    const url = req.nextUrl.clone();
    url.pathname = "/auth";
    url.searchParams.set("redirectedFrom", pathname + (search || ""));
    return redirectWithCookies(res, url, 307);
  }

  if (
    session?.user?.id &&
    !isLegalConfirmRoute &&
    !isAuthRoute &&
    !pathname.startsWith("/api") &&
    !isPublicRoute
  ) {
    const userId = session.user.id;

    const { data: profile, error: profErr } = await supabase
      .from("profiles")
      .select("agreed_terms,agreed_terms_at,is_adult,is_adult_at,terms_version")
      .eq("id", userId)
      .maybeSingle();

    const legalOk =
      !profErr &&
      profile?.agreed_terms === true &&
      profile?.is_adult === true &&
      !!profile?.agreed_terms_at &&
      !!profile?.is_adult_at &&
      !!profile?.terms_version;

    console.log("[proxy][legal]", {
      pathname,
      userId,
      profErr: profErr?.message ?? null,
      legalOk,
      profile: profile
        ? {
            agreed_terms: profile.agreed_terms,
            agreed_terms_at: !!profile.agreed_terms_at,
            is_adult: profile.is_adult,
            is_adult_at: !!profile.is_adult_at,
            terms_version: profile.terms_version ?? null,
          }
        : null,
    });

    if (!legalOk) {
      const url = req.nextUrl.clone();
      url.pathname = "/legal/confirm";
      url.searchParams.set("next", pathname + (search || ""));
      return redirectWithCookies(res, url, 307);
    }
  }

  if (session && isAuthRoot) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return redirectWithCookies(res, url, 307);
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};