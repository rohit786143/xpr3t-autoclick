import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, verifyAdminToken } from "./lib/auth";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public access to root, login page, auth endpoints, and demo target
  if (
    pathname === "/" ||
    pathname === "/admin/login" ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/demo-target")
  ) {
    if (pathname === "/admin/login") {
      const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
      if (token && (await verifyAdminToken(token))) {
        return NextResponse.redirect(new URL("/", request.url));
      }
    }
    return NextResponse.next();
  }

  // Protect /admin/* and /api/users/* and /api/worker/*
  const isProtectedPage = pathname.startsWith("/admin");
  const isProtectedApi =
    pathname.startsWith("/api/users") || pathname.startsWith("/api/worker");

  if (isProtectedPage || isProtectedApi) {
    const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    const verified = token ? await verifyAdminToken(token) : null;

    if (!verified) {
      if (isProtectedApi) {
        return NextResponse.json(
          { error: "Unauthorized. Admin session required." },
          { status: 401 }
        );
      }
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/admin/:path*", "/api/users/:path*", "/api/worker/:path*"],
};
