import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const isLogin = createRouteMatcher(["/uni/login"]);
const isUniRoute = createRouteMatcher(["/uni", "/uni/(.*)"]);

function applySecurityHeaders(response: NextResponse, request: NextRequest) {
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()"
  );
  response.headers.set("Content-Security-Policy", "frame-ancestors 'none'");
  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload"
    );
  }
  response.headers.set("X-DNS-Prefetch-Control", "off");
  if (request.nextUrl.pathname.startsWith("/api/")) {
    response.headers.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate"
    );
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");
  }
  return response;
}

export default convexAuthNextjsMiddleware(async (request, { convexAuth }) => {
  const isAuthed = await convexAuth.isAuthenticated();

  if (isUniRoute(request) && !isLogin(request) && !isAuthed) {
    return applySecurityHeaders(
      nextjsMiddlewareRedirect(request, "/uni/login"),
      request
    );
  }

  if (isLogin(request) && isAuthed) {
    return applySecurityHeaders(
      nextjsMiddlewareRedirect(request, "/uni"),
      request
    );
  }

  return applySecurityHeaders(NextResponse.next(), request);
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
