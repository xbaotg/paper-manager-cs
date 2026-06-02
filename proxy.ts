import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  SESSION_COOKIE,
  VIEW_MODE_COOKIE,
  decryptSession,
  homeFor,
  type ViewMode,
} from "@/lib/session";

// Optimistic edge gate: only checks the signed cookie (no DB). Authoritative
// role/ownership checks live in layouts, the DAL, and every server action.
// `nextUrl.clone()` preserves the "/paper" basePath on redirects.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl; // basePath-stripped, e.g. "/admin/..."
  const isLogin = pathname === "/login";

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await decryptSession(token);

  if (!session && !isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (session && isLogin) {
    const url = request.nextUrl.clone();
    const raw = request.cookies.get(VIEW_MODE_COOKIE)?.value;
    const mode: ViewMode | null = raw === "admin" || raw === "user" ? raw : null;
    // Optimistic (cookie-only) home; the DAL re-checks authoritatively.
    url.pathname = homeFor({
      role: session.role,
      isAdmin: session.isAdmin,
      lecturerId: session.lecturerId,
      mode,
    });
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/head/:path*", "/me/:path*", "/login"],
};
